# [Draft.js](https://facebook.github.io/draft-js/) [![Build Status](https://img.shields.io/travis/facebook/draft-js/master.svg?style=flat)](https://travis-ci.org/facebook/draft-js) [![npm version](https://img.shields.io/npm/v/draft-js.svg?style=flat)](https://www.npmjs.com/package/draft-js)

## Textio: How to Deploy

### Deploying From Master
1. Go to the `master` branch locally
2. Make sure it's up-to-date by running a `git pull --rebase`
3. Run `npm run rev`
4. Note the version number output. This is the same version number that CircleCI will deploy to npm. You can use this to update the `package.json` of a project that relies on this component
5. You're done!

### Deploying Beta Versions
Sometimes we need to deploy potentially unstable versions of editor for testing or deploying to topic branches. To do that, please:
1. Start from whatever branch you want to cut a beta version of
2. Run `npm run revbeta`
3. Note the version hash output, which looks like `v1.2.3-my-branch-name.1`. This is the same version number that CircleCI will deploy to npm. You can use this to update the `package.json` of a project beta that relies on this component

*IMPORTANT: Make sure you don't merge your beta package.json version back into master - that's up to all of us to catch in the PR*

## Important Note

We currently prepare for a 2.0 beta. The `master` branch already contains these features. All the packages are already published with a beta tag. Install it via `$ npm install <plugin>@2.0.0-beta5 --save`

---

Draft.js is a JavaScript rich text editor framework, built for React and
backed by an immutable model.

- **Extensible and Customizable:** We provide the building blocks to enable
the creation of a broad variety of rich text composition experiences, from
simple text styles to embedded media.
- **Declarative Rich Text:** Draft.js fits seamlessly into
[React](http://facebook.github.io/react/) applications,
abstracting away the details of rendering, selection, and input behavior with a
familiar declarative API.
- **Immutable Editor State:** The Draft.js model is built
with [immutable-js](https://facebook.github.io/immutable-js/), offering
an API with functional state updates and aggressively leveraging data persistence
for scalable memory usage.

[Learn how to use Draft.js in your own project.](https://facebook.github.io/draft-js/docs/overview.html)

## Examples

Visit https://facebook.github.io/draft-js/ to try out a simple rich editor example.

The repository includes a variety of different editor examples to demonstrate
some of the features offered by the framework.

To run the examples, first build Draft.js locally:

```
git clone https://github.com/facebook/draft-js.git
cd draft-js
npm install
npm run build
```

then open the example HTML files in your browser.

Draft.js is used in production on Facebook, including status and
comment inputs, [Notes](https://www.facebook.com/notes/), and
[messenger.com](https://www.messenger.com).

## Resources and Ecosystem

Check out this curated list of articles and open-sourced projects/utilities: [Awesome Draft-JS](https://github.com/nikgraf/awesome-draft-js).

## Discussion and Support

Join our [Slack team](https://draftjs.herokuapp.com)!

## Contribute

We actively welcome pull requests. Learn how to
[contribute](https://github.com/facebook/draft-js/blob/master/CONTRIBUTING.md).

## License

Draft.js is [BSD Licensed](https://github.com/facebook/draft-js/blob/master/LICENSE).
We also provide an additional [patent grant](https://github.com/facebook/draft-js/blob/master/PATENTS).

Examples provided in this repository and in the documentation are separately
licensed.
