import { ApiInterceptor } from '@/entrypoints/injector.content/ApiInterceptor'

export default defineContentScript({
  world: 'MAIN',
  matches: ['*://glovoapp.com/*'],
  runAt: 'document_start',
  main: () => {
    console.log('Injector script loaded for glovoapp.com')
    ApiInterceptor.init()
  },
})
