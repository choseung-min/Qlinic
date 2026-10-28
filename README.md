# Qlinic

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Staff and doctor login records

Staff and doctors use Firebase Authentication for their email and password, plus
a role profile in the `users` collection:

- Receptionists: `users/{uid}.role` is `staff`, with a matching
  `staff/{record}.staffId` and `uid`.
- Doctors: `users/{uid}.role` is `doctor`, with a matching record in either the
  `doctors` or `doctor` collection. The record must contain `uid` and a doctor
  ID beginning with `D`. The doctor ID can either be stored as `doctorId` or
  used as the document ID (for example, `D01`).

Doctors are routed to the placeholder Doctor dashboard at `/doctor`.
