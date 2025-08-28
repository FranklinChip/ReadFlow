import { AppProps } from 'next/app';
import Head from 'next/head';
import Providers from '@/components/Providers';

import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta
          name='viewport'
          content='minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover'
        />
        <meta name='application-name' content='ReadFlow' />
        <meta name='apple-mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-status-bar-style' content='default' />
        <meta name='apple-mobile-web-app-title' content='ReadFlow' />
        <meta
          name='description'
          content='ReadFlow helps readers enter flow state by intelligently explaining unknown words and phrases in English books clearly and accurately.'
        />
        <meta name='format-detection' content='telephone=no' />
        <meta name='mobile-web-app-capable' content='yes' />
        <meta name='theme-color' content='white' />
        <link rel='manifest' href='/manifest.json' />
      </Head>
      <Providers>
        <Component {...pageProps} />
      </Providers>
    </>
  );
}

export default MyApp;
