import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { colors } from '@/theme';
import { AssignmentEndedError, clearQueue, enqueue, flush, type QueuedPoint } from './queue';

export const LOCATION_TASK = 'teranga-fleet-location';

const ENABLED_KEY = 'tf.tracking.enabled';
const CONSENT_KEY = 'tf.tracking.consent';

/**
 * background : tâche système, positions transmises écran éteint (build natif).
 * foreground : uniquement application ouverte (Expo Go, ou autorisation
 * « toujours » refusée).
 */
export type TrackingMode = 'background' | 'foreground';

/** Expo Go ne permet pas les tâches de localisation en arrière-plan. */
export const backgroundSupported =
  Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

/** Fréquence raisonnable pour un suivi de flotte, économe en batterie et en données. */
const UPDATE_OPTIONS = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 60_000,
  distanceInterval: 100,
};

let foregroundSubscription: Location.LocationSubscription | null = null;

export function toPoint(location: Location.LocationObject): QueuedPoint {
  const { latitude, longitude, accuracy, speed, heading } = location.coords;
  return {
    latitude,
    longitude,
    accuracy: accuracy ?? undefined,
    // Les valeurs négatives signifient « inconnu » sur iOS.
    speed: speed !== null && speed >= 0 ? speed : undefined,
    heading: heading !== null && heading >= 0 ? heading : undefined,
    recordedAt: new Date(location.timestamp).toISOString(),
  };
}

/** Enregistre les positions reçues puis tente l'envoi ; arrête le suivi si l'affectation est finie. */
export async function handleLocations(locations: Location.LocationObject[]) {
  await enqueue(locations.map(toPoint));
  try {
    await flush();
  } catch (error) {
    if (error instanceof AssignmentEndedError) await stopTracking();
  }
}

export async function hasConsented(): Promise<boolean> {
  return Boolean(await AsyncStorage.getItem(CONSENT_KEY));
}

export async function giveConsent() {
  await AsyncStorage.setItem(CONSENT_KEY, new Date().toISOString());
}

/** Retrait du consentement : le suivi s'arrête et ne reprendra pas sans nouvel accord. */
export async function withdrawConsent() {
  await stopTracking();
  await AsyncStorage.removeItem(CONSENT_KEY);
}

export async function isTrackingEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === '1';
}

export async function currentMode(): Promise<TrackingMode | null> {
  if (!(await isTrackingEnabled())) return null;
  if (backgroundSupported && (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))) {
    return 'background';
  }
  return foregroundSubscription ? 'foreground' : null;
}

/**
 * Démarre le service (le chauffeur passe « En service »). Demande les
 * autorisations ; renvoie le mode obtenu. Lève une erreur lisible si la
 * localisation est refusée.
 */
export async function startTracking(): Promise<TrackingMode> {
  if (Platform.OS === 'web') throw new Error("La localisation n'est disponible que sur téléphone.");
  if (!(await hasConsented())) throw new Error('Acceptez d’abord le partage de position.');

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    throw new Error(
      'Autorisez l’accès à la position dans les réglages du téléphone pour passer en service.',
    );
  }

  let mode: TrackingMode = 'foreground';
  if (backgroundSupported) {
    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status === 'granted') {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        ...UPDATE_OPTIONS,
        deferredUpdatesInterval: 60_000,
        pausesUpdatesAutomatically: true,
        activityType: Location.ActivityType.AutomotiveNavigation,
        showsBackgroundLocationIndicator: true,
        // Android : notification permanente obligatoire pendant le suivi.
        foregroundService: {
          notificationTitle: 'Teranga Fleet · En service',
          notificationBody: 'La position du véhicule est partagée avec votre gestionnaire.',
          notificationColor: colors.brand,
        },
      });
      mode = 'background';
    }
  }

  if (mode === 'foreground' && !foregroundSubscription) {
    foregroundSubscription = await Location.watchPositionAsync(UPDATE_OPTIONS, (location) => {
      void handleLocations([location]);
    });
  }

  await AsyncStorage.setItem(ENABLED_KEY, '1');
  // Premier point immédiat : le gestionnaire voit le véhicule sans attendre.
  void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    .then((location) => handleLocations([location]))
    .catch(() => undefined);
  return mode;
}

/** Fin de service : arrêt de la collecte et envoi des derniers points. */
export async function stopTracking() {
  await AsyncStorage.setItem(ENABLED_KEY, '0');
  foregroundSubscription?.remove();
  foregroundSubscription = null;
  if (backgroundSupported && (await TaskManager.isTaskRegisteredAsync(LOCATION_TASK))) {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  }
  await flush().catch(() => undefined);
}

/** Déconnexion : plus aucune donnée de suivi ne doit rester sur le téléphone. */
export async function resetTracking() {
  await stopTracking();
  await clearQueue();
  await AsyncStorage.removeItem(ENABLED_KEY);
}

/**
 * Au lancement de l'application : reprend le service si le chauffeur l'avait
 * laissé actif (le suivi au premier plan ne survit pas à la fermeture de l'app).
 */
export async function resumeTracking(): Promise<TrackingMode | null> {
  if (!(await isTrackingEnabled()) || !(await hasConsented())) return null;
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') return null;
  try {
    return await startTracking();
  } catch {
    return null;
  }
}
