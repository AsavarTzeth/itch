import { actions } from "common/actions";
import { hookLogging, messages } from "common/butlerd";
import { t } from "common/format/t";
import { modals } from "common/modals";
import { ItchPromise } from "common/util/itch-promise";
import { Watcher } from "common/util/watcher";
import { dialog } from "electron";
import { mcall } from "main/butlerd/mcall";
import { mainLogger, makeLogger } from "main/logger";
import * as explorer from "main/os/explorer";
import { promisedModal } from "main/reactors/modals";
import { getNativeWindow } from "main/reactors/winds";
import memory from "memory-streams";
import { _ } from "renderer/t";
import { formatError } from "common/format/errors";
import { format } from "url";

const logger = mainLogger.child(__filename);

export default function(watcher: Watcher) {
  watcher.on(actions.removeInstallLocation, async (store, action) => {
    const { id } = action.payload;

    const { installLocations } = await mcall(messages.InstallLocationsList, {});
    if (installLocations.length <= 1) {
      // refuse to remove the last one
      return;
    }

    const { installLocation } = await mcall(messages.InstallLocationsGetByID, {
      id,
    });
    if (!installLocation) {
      return;
    }

    {
      const res = await promisedModal(
        store,
        modals.naked.make({
          wind: "root",
          title: ["prompt.install_location_remove.title"],
          message: ["prompt.install_location_remove.message"],
          detail: [
            "prompt.install_location_remove.detail",
            {
              location: installLocation.path,
            },
          ],
          buttons: [
            {
              label: ["prompt.action.confirm_removal"],
              action: actions.modalResponse({}),
            },
            "cancel",
          ],
          widgetParams: null,
        })
      );

      if (!res) {
        // modal was closed
        return;
      }

      const memlog = new memory.WritableStream();
      try {
        const logger = makeLogger({ customOut: memlog });
        await mcall(messages.InstallLocationsRemove, { id }, convo => {
          hookLogging(convo, logger);
        });
        store.dispatch(actions.installLocationsChanged({}));
      } catch (e) {
        store.dispatch(
          actions.openModal(
            modals.showError.make({
              wind: "root",
              title: _("prompt.show_error.generic_message"),
              message: t(store.getState().i18n, formatError(e)),
              widgetParams: {
                rawError: e,
                log: memlog.toString(),
                forceDetails: true,
              },
              buttons: ["ok"],
            })
          )
        );
      }
    }
  });

  watcher.on(actions.addInstallLocation, async (store, action) => {
    const { wind } = action.payload;
    const i18n = store.getState().i18n;
    const nativeWindow = getNativeWindow(store.getState(), wind);
    if (!nativeWindow) {
      return;
    }

    const dialogOpts = {
      title: t(i18n, ["prompt.install_location_add.title"]),
      // crazy typescript workaround, avert your eyes
      properties: ["openDirectory", "createDirectory"] as (
        | "openDirectory"
        | "createDirectory")[],
    };

    const promise = new ItchPromise<string>((resolve, reject) => {
      const callback = (response: string[]) => {
        if (!response) {
          return resolve();
        }

        return resolve(response[0]);
      };
      dialog.showOpenDialog(nativeWindow, dialogOpts, callback);
    });

    const path = await promise;
    if (path) {
      const { installLocation } = await mcall(
        messages.InstallLocationsAdd,
        { path },
        convo => {
          hookLogging(convo, logger);
        }
      );
      store.dispatch(
        actions.updatePreferences({
          defaultInstallLocation: installLocation.id,
        })
      );
      store.dispatch(actions.installLocationsChanged({}));
      store.dispatch(actions.silentlyScanInstallLocations({}));
    }
  });

  watcher.on(actions.browseInstallLocation, async (store, action) => {
    const { id } = action.payload;
    const { installLocation } = await mcall(messages.InstallLocationsGetByID, {
      id,
    });
    if (installLocation) {
      explorer.open(installLocation.path);
    }
  });
}
