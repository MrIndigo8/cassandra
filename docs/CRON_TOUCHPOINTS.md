# Частый запуск обработки touchpoints

На **Vercel Hobby** разрешён только **один** cron в сутки (`/api/cron`). Уведомления с задержками 2 ч / 24 ч обрабатываются при срабатывании этого cron — фактическая задержка может быть до ~24 ч.

## Вариант A: эндпоинт `POST /api/process-touchpoints-light`

- Тот же сценарий, что `POST /api/process-touchpoints`, но **не более 50** записей за вызов.
- Заголовок: `Authorization: Bearer <CRON_SECRET>` (тот же секрет, что у остальных cron-маршрутов).
- Вызывайте из внешнего расписания каждые 1–2 часа (например **GitHub Actions**, **cron-job.org**, UptimeRobot с POST).

Пример `curl`:

```bash
curl -X POST "https://YOUR_DOMAIN/api/process-touchpoints-light" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Вариант B: workflow в репозитории

См. `.github/workflows/touchpoints-cron.yml` — при настройке секрета `CRON_SECRET` и `APP_URL` в GitHub Actions.

## Вариант C: полный процессинг

`POST /api/process-touchpoints` — до **100** строк за вызов; обычно вызывается из оркестратора `/api/cron` раз в сутки.
