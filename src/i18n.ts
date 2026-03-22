import {getRequestConfig} from 'next-intl/server';

export default getRequestConfig(async ({locale}) => ({
  locale: locale || 'ru',
  messages: (await import(`../messages/${locale || 'ru'}.json`)).default
}));
