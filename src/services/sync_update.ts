import sql = require('./sql');
import log = require('./log');
import entityChangesService = require('./entity_changes');
import eventService = require('./events');
import entityConstructor = require('../becca/entity_constructor');
import ws = require('./ws');
import { EntityChange, EntityChangeRecord, EntityRow } from './entity_changes_interface';

interface UpdateContext {
    alreadyErased: number;
    erased: number;
    updated: Record<string, string[]>
}

function updateEntities(entityChanges: EntityChangeRecord[], instanceId: string) {
    if (entityChanges.length === 0) {
        return;
    }

    let atLeastOnePullApplied = false;
    const updateContext = {
        updated: {},
        alreadyUpdated: 0,
        erased: 0,
        alreadyErased: 0
    };

    for (const {entityChange, entity} of entityChanges) {
        const changeAppliedAlready = entityChange.changeId
            && !!sql.getValue("SELECT 1 FROM entity_changes WHERE changeId = ?", [entityChange.changeId]);

        if (changeAppliedAlready) {
            updateContext.alreadyUpdated++;

            continue;
        }

        if (!atLeastOnePullApplied) { // avoid spamming and send only for first
            ws.syncPullInProgress();

            atLeastOnePullApplied = true;
        }

        if (entity) {
            updateEntity(entityChange, entity, instanceId, updateContext);
        }
    }

    logUpdateContext(updateContext);
}

function updateEntity(remoteEC: EntityChange, remoteEntityRow: EntityRow, instanceId: string, updateContext: UpdateContext) {
    if (!remoteEntityRow && remoteEC.entityName === 'options') {
        return; // can be undefined for options with isSynced=false
    }

    const updated = remoteEC.entityName === 'note_reordering'
        ? updateNoteReordering(remoteEC, remoteEntityRow, instanceId)
        : updateNormalEntity(remoteEC, remoteEntityRow, instanceId, updateContext);

    if (updated) {
        if (remoteEntityRow?.isDeleted) {
            eventService.emit(eventService.ENTITY_DELETE_SYNCED, {
                entityName: remoteEC.entityName,
                entityId: remoteEC.entityId
            });
        }
        else if (!remoteEC.isErased) {
            eventService.emit(eventService.ENTITY_CHANGE_SYNCED, {
                entityName: remoteEC.entityName,
                entityRow: remoteEntityRow
            });
        }
    }
}

function updateNormalEntity(remoteEC: EntityChange, remoteEntityRow: EntityRow, instanceId: string, updateContext: UpdateContext) {
    const localEC = sql.getRow<EntityChange>(`SELECT * FROM entity_changes WHERE entityName = ? AND entityId = ?`, [remoteEC.entityName, remoteEC.entityId]);

    if (!localEC.utcDateChanged || !remoteEC.utcDateChanged) {
        throw new Error("Missing date changed.");
    }

    if (!localEC || localEC.utcDateChanged <= remoteEC.utcDateChanged) {
        if (remoteEC.isErased) {
            if (localEC?.isErased) {
                eraseEntity(remoteEC); // make sure it's erased anyway
                updateContext.alreadyErased++;
            } else {
                eraseEntity(remoteEC);
                updateContext.erased++;
            }
        } else {
            if (!remoteEntityRow) {
                throw new Error(`Empty entity row for: ${JSON.stringify(remoteEC)}`);
            }

            preProcessContent(remoteEC, remoteEntityRow);

            sql.replace(remoteEC.entityName, remoteEntityRow);

            updateContext.updated[remoteEC.entityName] = updateContext.updated[remoteEC.entityName] || [];
            updateContext.updated[remoteEC.entityName].push(remoteEC.entityId);
        }

        if (!localEC
            || localEC.utcDateChanged < remoteEC.utcDateChanged
            || localEC.hash !== remoteEC.hash
            || localEC.isErased !== remoteEC.isErased
        ) {
            entityChangesService.putEntityChangeWithInstanceId(remoteEC, instanceId);
        }

        return true;
    } else if ((localEC.hash !== remoteEC.hash || localEC.isErased !== remoteEC.isErased)
                && localEC.utcDateChanged > remoteEC.utcDateChanged) {
        // the change on our side is newer than on the other side, so the other side should update
        entityChangesService.putEntityChangeForOtherInstances(localEC);

        return false;
    }

    return false;
}

function preProcessContent(remoteEC: EntityChange, remoteEntityRow: EntityRow) {
    if (remoteEC.entityName === 'blobs' && remoteEntityRow.content !== null) {
        // we always use a Buffer object which is different from normal saving - there we use a simple string type for
        // "string notes". The problem is that in general, it's not possible to detect whether a blob content
        // is string note or note (syncs can arrive out of order)
        if (typeof remoteEntityRow.content === "string") {
            remoteEntityRow.content = Buffer.from(remoteEntityRow.content, 'base64');

            if (remoteEntityRow.content.byteLength === 0) {
                // there seems to be a bug which causes empty buffer to be stored as NULL which is then picked up as inconsistency
                // (possibly not a problem anymore with the newer better-sqlite3)
                remoteEntityRow.content = "";
            }
        }
    }
}

function updateNoteReordering(remoteEC: EntityChange, remoteEntityRow: EntityRow, instanceId: string) {
    if (!remoteEntityRow) {
        throw new Error(`Empty note_reordering body for: ${JSON.stringify(remoteEC)}`);
    }

    for (const key in remoteEntityRow) {
        sql.execute("UPDATE branches SET notePosition = ? WHERE branchId = ?", [remoteEntityRow[key as keyof EntityRow], key]);
    }

    entityChangesService.putEntityChangeWithInstanceId(remoteEC, instanceId);

    return true;
}

function eraseEntity(entityChange: EntityChange) {
    const {entityName, entityId} = entityChange;

    const entityNames = [
        "notes",
        "branches",
        "attributes",
        "revisions",
        "attachments",
        "blobs"
    ];

    if (!entityNames.includes(entityName)) {
        log.error(`Cannot erase ${entityName} '${entityId}'.`);
        return;
    }

    const primaryKeyName = entityConstructor.getEntityFromEntityName(entityName).primaryKeyName;

    sql.execute(`DELETE FROM ${entityName} WHERE ${primaryKeyName} = ?`, [entityId]);
}

function logUpdateContext(updateContext: UpdateContext) {
    const message = JSON.stringify(updateContext)
        .replaceAll('"', '')
        .replaceAll(":", ": ")
        .replaceAll(",", ", ");

    log.info(message.substr(1, message.length - 2));
}

export = {
    updateEntities
};
