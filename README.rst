frontend-app-sessions
#####################

|license-badge|

Purpose
*******

``frontend-app-sessions`` is the Open edX Sessions and Attendance MFE. It provides:

- A calendar view of scheduled live sessions (Zoom / Microsoft Teams)
- Per-learner session request submission (remote Zoom join, leave requests)
- Instructor and admin tools: attendance roster, per-session/per-learner/course-summary reports, location management

This MFE is part of the `tutor-contrib-fbr <https://github.com/edly-io/tutor-contrib-fbr>`_ plugin ecosystem and is deployed via Tutor at port **1998** (``http://apps.local.openedx.io:1998``).

Getting Started
***************

Prerequisites
=============

- Node 18+ (see ``.nvmrc``)
- A running Open edX devstack (Tutor 21.x) with the ``fbr`` plugin enabled

Local Development
=================

.. code-block:: bash

    # 1. Install dependencies
    npm install

    # 2. Start the webpack dev server (hot reload)
    npm start
    # → http://apps.local.openedx.io:1998

The dev server talks to the LMS at ``http://local.openedx.io:8000`` (configured in ``.env.development``).

Tutor Setup
===========

.. code-block:: bash

    # Install plugin
    pip install -e path/to/tutor-contrib-fbr
    tutor plugins enable fbr

    # Generate Caddy route and CORS whitelist for port 1998
    tutor config save

    # Restart services to pick up config changes
    tutor dev restart lms
    tutor dev restart mfe

Environment Variables
=====================

Key variables in ``.env.development``:

+------------------------------+-----------------------------------------------+
| Variable                     | Description                                   |
+==============================+===============================================+
| ``PORT``                     | Dev server port (``1998``)                    |
+------------------------------+-----------------------------------------------+
| ``APP_ID``                   | MFE identifier (``sessions``)                 |
+------------------------------+-----------------------------------------------+
| ``LMS_BASE_URL``             | LMS host                                      |
+------------------------------+-----------------------------------------------+
| ``MFE_CONFIG_API_URL``       | MFE runtime config endpoint on LMS            |
+------------------------------+-----------------------------------------------+

Routes
======

+------------------------------------------+--------------------------------------+
| Path                                     | Component                            |
+==========================================+======================================+
| ``/sessions``                            | Calendar (learner view)              |
+------------------------------------------+--------------------------------------+
| ``/sessions/:programId/calendar``        | Calendar scoped to a program         |
+------------------------------------------+--------------------------------------+
| ``/sessions/:programId/requests``        | Learner request list                 |
+------------------------------------------+--------------------------------------+
| ``/sessions/:programId/attendance``      | Attendance reports (admin/instructor)|
+------------------------------------------+--------------------------------------+
| ``/sessions/:programId/locations``       | Location management (admin)          |
+------------------------------------------+--------------------------------------+

Testing
*******

.. code-block:: bash

    npm test              # Jest with coverage
    npm run test:watch    # Jest in watch mode
    npm run lint          # ESLint + TypeScript type check
    npm run types         # TypeScript type check only

License
*******

The code in this repository is licensed under the AGPL v3 unless otherwise noted.

Prerequisites
=============

`Tutor`_ is currently recommended as the development environment for your
new MFE.  You can refer to the `relevant tutor-mfe documentation`_ to get started using it.

.. _Tutor: https://github.com/overhangio/tutor

.. _relevant tutor-mfe documentation: https://github.com/overhangio/tutor-mfe#mfe-development

Cloning and Startup
===================

In the following steps, replace "[PLACEHOLDER]" with the name of the repo you
created when copying this template above.

1. Clone your new repo:

  ``git clone https://github.com/openedx/frontend-app-[PLACEHOLDER].git``

2. Use the version of Node specified in the ``.nvmrc`` file.

  The current version of the micro-frontend build scripts supports the version of Node found in ``.nvmrc``.
  Using other major versions of node *may* work, but this is unsupported.  For
  convenience, this repository includes an .nvmrc file to help in setting the
  correct node version via `nvm <https://github.com/nvm-sh/nvm>`_.

3. Install npm dependencies:

  ``cd frontend-app-[PLACEHOLDER] && npm install``

4. Update the application port to use for local development:

   Default port is 8080. If this does not work for you, update the line
   `PORT=8080` to your port in all .env.* files

5. Start the dev server:

  ``npm start``

The dev server is running at `http://localhost:8080 <http://localhost:8080>`_
or whatever port you setup.

Making Your New Project's README File
=====================================

Move ``README-template-frontend-app.rst`` to your project's ``README.rst``
file. Please fill out all the sections - this helps out all developers
understand your MFE, how to install it, and how to use it.

Developing
**********

This section concerns development of ``frontend-template-application`` itself,
not the templated copy.

It should be noted that one of the goals of this repository is for it to
function correctly as an MFE (as in ``npm install && npm start``) even if no
modifications are made.  This ensures that developers get a *practical* working
example, not just a theoretical one.

This also means, of course, that any committed code should be tested and
subject to both CI and branch protection rules.

Project Structure
=================

The source for this project is organized into nested submodules according to
the `Feature-based Application Organization ADR`_.

.. _Feature-based Application Organization ADR: https://github.com/openedx/frontend-template-application/blob/master/docs/decisions/0002-feature-based-application-organization.rst

Build Process Notes
===================

**Production Build**

The production build is created with ``npm run build``.

Internationalization
====================

Please see refer to the `frontend-platform i18n howto`_ for documentation on
internationalization.

.. _frontend-platform i18n howto: https://github.com/openedx/frontend-platform/blob/master/docs/how_tos/i18n.rst

Getting Help
************

If you're having trouble, we have discussion forums at
https://discuss.openedx.org where you can connect with others in the community.

Our real-time conversations are on Slack. You can request a `Slack
invitation`_, then join our `community Slack workspace`_.  Because this is a
frontend repository, the best place to discuss it would be in the `#wg-frontend
channel`_.

For anything non-trivial, the best path is to open an issue in this repository
with as many details about the issue you are facing as you can provide.

https://github.com/openedx/frontend-template-application/issues

For more information about these options, see the `Getting Help`_ page.

.. _Slack invitation: https://openedx.org/slack
.. _community Slack workspace: https://openedx.slack.com/
.. _#wg-frontend channel: https://openedx.slack.com/archives/C04BM6YC7A6
.. _Getting Help: https://openedx.org/getting-help

License
*******

The code in this repository is licensed under the AGPLv3 unless otherwise
noted.

Please see `LICENSE <LICENSE>`_ for details.

Contributing
************

Contributions are very welcome.  Please read `How To Contribute`_ for details.

.. _How To Contribute: https://openedx.org/r/how-to-contribute

This project is currently accepting all types of contributions, bug fixes,
security fixes, maintenance work, or new features.  However, please make sure
to have a discussion about your new feature idea with the maintainers prior to
beginning development to maximize the chances of your change being accepted.
You can start a conversation by creating a new issue on this repo summarizing
your idea.

The Open edX Code of Conduct
****************************

All community members are expected to follow the `Open edX Code of Conduct`_.

.. _Open edX Code of Conduct: https://openedx.org/code-of-conduct/

People
******

The assigned maintainers for this component and other project details may be
found in `Backstage`_. Backstage pulls this data from the ``catalog-info.yaml``
file in this repo.

.. _Backstage: https://open-edx-backstage.herokuapp.com/catalog/default/component/frontend-template-application

Reporting Security Issues
*************************

Please do not report security issues in public, and email security@openedx.org instead.

.. |license-badge| image:: https://img.shields.io/github/license/openedx/frontend-template-application.svg
    :target: https://github.com/openedx/frontend-template-application/blob/main/LICENSE
    :alt: License

.. |status-badge| image:: https://img.shields.io/badge/Status-Maintained-brightgreen

.. |ci-badge| image:: https://github.com/openedx/frontend-template-application/actions/workflows/ci.yml/badge.svg
    :target: https://github.com/openedx/frontend-template-application/actions/workflows/ci.yml
    :alt: Continuous Integration

.. |codecov-badge| image:: https://codecov.io/github/openedx/frontend-template-application/coverage.svg?branch=main
    :target: https://codecov.io/github/openedx/frontend-template-application?branch=main
    :alt: Codecov
