import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { backgroundSupported, handleLocations, LOCATION_TASK } from './tracking';

/**
 * Tâche exécutée par le système, application en arrière-plan ou écran éteint.
 * Elle doit être définie au chargement du module, avant tout rendu : ce
 * fichier est importé en premier par le layout racine.
 */
if (backgroundSupported) {
  TaskManager.defineTask<{ locations: LocationObject[] }>(
    LOCATION_TASK,
    async ({ data, error }) => {
      if (error || !data?.locations?.length) return;
      await handleLocations(data.locations);
    },
  );
}
