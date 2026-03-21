/**
 * Push-уведомления для утренних напоминаний.
 * Использует Web Push API + Service Worker.
 */

/** Запрашивает разрешение на push-уведомления */
export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('[Push] Уведомления не поддерживаются в этом браузере');
    return false;
  }

  if (Notification.permission === 'granted') {
    await registerServiceWorker();
    scheduleMorningReminder();
    return true;
  }

  if (Notification.permission === 'denied') {
    console.log('[Push] Уведомления заблокированы пользователем');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    await registerServiceWorker();
    scheduleMorningReminder();
    return true;
  }

  return false;
}

/** Регистрация Service Worker */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('[Push] Service Worker зарегистрирован:', registration.scope);
    return registration;
  } catch (err) {
    console.error('[Push] Ошибка регистрации Service Worker:', err);
    return null;
  }
}

/** Планирует утреннее напоминание на 7:00 */
export function scheduleMorningReminder(): void {
  const now = new Date();
  const next7am = new Date(now);
  next7am.setHours(7, 0, 0, 0);

  // Если уже прошло 7 утра сегодня → планируем на завтра
  if (now >= next7am) {
    next7am.setDate(next7am.getDate() + 1);
  }

  const msUntil7am = next7am.getTime() - now.getTime();

  setTimeout(() => {
    showMorningNotification();
    // После показа — планируем следующее уведомление через 24 часа
    setInterval(showMorningNotification, 24 * 60 * 60 * 1000);
  }, msUntil7am);

  console.log(`[Push] Утреннее напоминание запланировано через ${Math.round(msUntil7am / 60000)} мин.`);
}

/** Показывает утреннее уведомление */
function showMorningNotification(): void {
  if (Notification.permission !== 'granted') return;

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'MORNING_REMINDER',
    });
  } else {
    // Fallback — показываем через API Notification напрямую
    new Notification('Кассандра 🔮', {
      body: 'Что вам приснилось? Запишите пока помните 🔮',
      icon: '/icon-192.png',
      tag: 'morning-reminder',
    });
  }
}
