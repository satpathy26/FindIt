# FindIt — Campus Lost and Found System

FindIt is a campus lost-and-found web application where students can report lost or found items, browse campus reports, and contact a reporter when that student has chosen to share their contact details.

## Table of contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation and setup](#installation-and-setup)
- [MongoDB configuration](#mongodb-configuration)
- [Run the application](#run-the-application)
- [API reference](#api-reference)
- [Image uploads](#image-uploads)
- [Security and privacy](#security-and-privacy)
- [Tests](#tests)
- [Troubleshooting](#troubleshooting)
- [Future improvements](#future-improvements)

## Features

- Student account registration and login using email and password.
- Password hashing with bcryptjs and JWT-based bearer authentication.
- Create lost or found item reports with a photo, category, location, and report date.
- Browse active campus reports, search them, and filter by type, category, and status.
- Paginated item results and a page with each report's details.
- View a student's own reports, edit or delete them, and resolve or reopen them.
- Optional contact sharing: email and phone remain private unless the student opts in. Contact details are returned only by the authenticated contact endpoint for an active report.
- Responsive HTML, CSS, and vanilla JavaScript pages for the landing page, signup, login, dashboard, item report form, and item details.
- Local development health endpoint that reports whether MongoDB is connected.

## Technology stack

| Area | Technology |
| --- | --- |
| Frontend | HTML5, CSS3, vanilla JavaScript, Fetch API |
| Backend | Node.js, Express.js |
| Database | MongoDB with Mongoose |
| Authentication | bcryptjs, JSON Web Tokens (`jsonwebtoken`) |
| Image uploads | Multer, local files under `backend/uploads/` |
| Tests | Node.js integration test scripts |

## Architecture

The frontend is a static site served by a small Node HTTP server. It calls the Express API at `http://localhost:8000` by default. The API connects to MongoDB and serves uploaded report photos from `/uploads`.

```text
FindIt/
├── backend/
│   ├── config/db.js                # Mongoose connection
│   ├── controllers/                # Authentication and item request handlers
│   ├── middleware/                 # JWT auth, upload processing, error handling
│   ├── models/                     # User and Item schemas
│   ├── routes/                     # /api/auth and /api/items routes
│   ├── tests/                      # Auth and item integration tests
│   ├── uploads/                    # Local report photos (ignored by Git)
│   └── server.js                   # Express app and API server
├── frontend/
│   ├── css/                        # Shared styles and components
│   ├── js/                         # API helper and page scripts
│   ├── *.html                      # Static application pages
│   └── server.js                   # Static frontend server
├── .env.example                    # Safe environment-variable template
├── .gitignore
├── package.json
└── README.md
```

## Prerequisites

- Node.js 20.19 or newer and npm (Mongoose 9 requires Node.js 20.19 or later).
- MongoDB running locally, or a MongoDB Atlas cluster and connection URI.
- Git is optional if you already have the project files.

The setup commands below work on macOS, Linux, and Windows. Use Terminal on macOS/Linux or PowerShell on Windows. Install MongoDB Community Server using its instructions for your operating system, or use MongoDB Atlas.

## Installation and setup

1. Open a terminal in the project root (the directory containing `package.json`).
2. Install the dependencies:

   ```bash
   npm install
   ```

3. Create a local environment file from the template.

   macOS/Linux:

   ```bash
   cp .env.example .env
   ```

   Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Generate a private JWT secret. Run this command and paste the output into `.env` as the value of `JWT_SECRET`:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Keep `.env` private. Do not commit or share its contents.

## MongoDB configuration

### Local MongoDB

Set `MONGODB_URI` in the root `.env` file to the local database URI:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/findit
```

Make sure the MongoDB service is running before starting the backend. On macOS with MongoDB installed through Homebrew, the service is commonly started with:

```bash
brew services start mongodb-community
```

The service name can vary by the MongoDB version and installation method. On Linux or Windows, start MongoDB using the service manager or command used by your installation.

### MongoDB Atlas

1. Create a MongoDB Atlas cluster and database user.
2. Add the development machine's IP address to the Atlas network access list.
3. Copy the cluster connection string and put it in `.env` as `MONGODB_URI`.
4. Replace the username, password, and database name in the URI with your own values. URL-encode special characters in the database password.

Do not put Atlas credentials in this README or commit them to source control.

## Environment variables

The committed `.env.example` contains placeholders and non-secret local defaults:

```dotenv
PORT=8000
FRONTEND_ORIGIN=http://localhost:5500,http://127.0.0.1:5500
MONGODB_URI=mongodb://127.0.0.1:27017/findit
JWT_SECRET=replace_with_a_long_random_secret
```

| Variable | Purpose |
| --- | --- |
| `PORT` | Express API port. Defaults to `8000` when unset. |
| `FRONTEND_ORIGIN` | Comma-separated browser origins allowed by CORS. Defaults to the two local frontend URLs shown above. |
| `MONGODB_URI` | MongoDB connection URI. Required by the backend. |
| `JWT_SECRET` | Secret used to sign and verify login tokens. Set a long random value; never use the example placeholder. |

The frontend server also accepts an optional `FRONTEND_PORT` environment variable and defaults to `5500`. The API helper uses `http://localhost:8000` as its default base URL. For a different API host, the frontend helper supports `window.FINDIT_API_BASE`.

## Run the application

Open two terminals in the project root.

Terminal 1 — start the API (and MongoDB connection):

```bash
npm run start
```

Terminal 2 — start the frontend static server:

```bash
npm run frontend
```

Open the frontend at <http://localhost:5500>. The API runs at <http://localhost:8000>; its database health endpoint is <http://localhost:8000/api/health>.

For backend development with automatic restart, use `npm run dev` instead of `npm run start`.

## API reference

All API paths are relative to `http://localhost:8000`. Protected routes expect:

```http
Authorization: Bearer <JWT>
```

JSON request bodies use `Content-Type: application/json`. Item creation and image replacement use `multipart/form-data` with the photo in the `image` field.

### Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | No | Reports API status and MongoDB connection status. Returns `200` when connected and `503` otherwise. |

### Authentication

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Register with `name`, `rollNo`, `email`, `phone`, and `password`. Returns `201`; duplicate email or roll number returns `409`. |
| `POST` | `/api/auth/login` | No | Sign in with `email` and `password`. Returns a JWT and safe user profile; invalid credentials return `401`. The token expires after seven days. |
| `GET` | `/api/auth/me` | Bearer token | Return the authenticated student's profile. |
| `PATCH` | `/api/auth/contact-sharing` | Bearer token | Set the student's contact-sharing preference with `{"shareContact": true}` or `false`. The preference defaults to `false`. |

### Items

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/items` | Bearer token | Create a lost/found report. Multipart fields: `title`, `description`, `type`, `category`, `location`, `date`, and required `image`. The reporter is taken from the token. |
| `GET` | `/api/items` | No | List reports. Defaults to active reports. See query parameters below. |
| `GET` | `/api/items/my` | Bearer token | List the authenticated student's own reports, including their statuses. Supports `page` and `limit`. |
| `GET` | `/api/items/:id` | No | Get one report and the reporter's display name. Does not return reporter email or phone. |
| `GET` | `/api/items/:id/contact` | Bearer token | Request the reporter's name, email, and phone. The report must be active and the reporter must have opted into contact sharing (the reporter can also access their own details). |
| `PATCH` | `/api/items/:id` | Bearer token | Update an owned report's `title`, `description`, `type`, `category`, `location`, or `date`; optionally replace its `image`. Status and reporter cannot be changed here. |
| `PATCH` | `/api/items/:id/resolve` | Bearer token | Mark an owned report as resolved. |
| `PATCH` | `/api/items/:id/reopen` | Bearer token | Reopen an owned resolved report. |
| `DELETE` | `/api/items/:id` | Bearer token | Delete an owned report and its locally stored photo. |

`GET /api/items` supports these query parameters:

| Parameter | Accepted values / behavior |
| --- | --- |
| `type` | `lost` or `found` |
| `category` | A category string, such as `electronics` |
| `search` | Case-insensitive search across title, description, category, and location; regular-expression characters are treated literally |
| `status` | `active` or `resolved`; defaults to `active` |
| `page` | Positive whole number; defaults to `1` |
| `limit` | Whole number from `1` to `50`; defaults to `10` |

List endpoints return an `items` array and `pagination` metadata (`page`, `limit`, `totalItems`, `totalPages`, `hasNextPage`, and `hasPreviousPage`). Typical error codes include `400` for invalid input or ID, `401` for missing/invalid authentication, `403` for ownership or consent denial, `404` for missing records, and `409` for duplicate registration or contact requests on resolved items.

## Image uploads

- Upload one JPEG, PNG, or WebP image in the `image` field.
- Maximum file size is 5 MB.
- Multer stores photos in `backend/uploads/` using a generated UUID filename; the submitted client filename is not used.
- The API checks the file's image signature as well as its declared MIME type.
- MongoDB stores a URL path such as `/uploads/<generated-name>.png`, not the image bytes.
- Express serves these files at `http://localhost:8000/uploads/<generated-name>`.
- Replacing or deleting an owned report removes its old file; invalid uploads and failed database saves are cleaned up.
- The upload directory is excluded from Git. Back up any local images you need; they are not part of source control.

## Security and privacy

- Passwords are hashed with bcryptjs and excluded from normal user queries and API profiles.
- Login tokens are signed using `JWT_SECRET`, expire after seven days, and are sent as bearer tokens.
- The frontend stores the token in `sessionStorage`, not the password. JavaScript running on the same origin can access session storage, so this is a simple student-project approach rather than an HttpOnly-cookie session design.
- Item create, edit, resolve, reopen, and delete operations require authentication. The API derives the reporter from the verified token and checks ownership on changes.
- Item updates use an explicit field allowlist; clients cannot assign `reporter` or `status` through the general update route.
- Reporter contact details are omitted from shared item list and detail responses. The contact endpoint requires authentication and checks server-side consent and report status.
- CORS is configured for the frontend origins in `FRONTEND_ORIGIN`. Configure the exact origins used by your deployment.
- `.env`, `.env.*` files (except `.env.example`), `node_modules`, log files, and uploaded files under `backend/uploads/` are ignored by Git.
- For a public deployment, use HTTPS, secure secret management, production CORS origins, and a production-grade session/storage review.

## Tests

Run the existing integration tests from the project root:

```bash
npm test
```

The scripts use MongoDB and create test data in a database whose name ends with `_test`, based on `MONGODB_URI`. They exercise authentication and item API behavior, including ownership, consent, status changes, and uploads. Ensure MongoDB is available and `.env` has `MONGODB_URI` and `JWT_SECRET` configured before running them.

## Troubleshooting

| Problem | Checks |
| --- | --- |
| Backend says `MONGODB_URI is missing` | Create the root `.env` from `.env.example` and set `MONGODB_URI`. |
| MongoDB connection refused or health endpoint returns `503` | Start the local MongoDB service, check the URI and port, or verify Atlas network access and credentials. |
| `EADDRINUSE` for port 8000 or 5500 | Another process is using that port. Stop it or set `PORT` / `FRONTEND_PORT`; update `FRONTEND_ORIGIN` if the frontend port changes. |
| Browser cannot reach the API | Confirm both servers are running, check `window.FINDIT_API_BASE`, and ensure the frontend origin is listed in `FRONTEND_ORIGIN`. |
| Login fails after changing `JWT_SECRET` | Existing tokens were signed with the previous secret; sign in again to receive a new token. |
| Image upload is rejected | Use JPEG, PNG, or WebP, keep the file at or below 5 MB, and submit it in the `image` field. |
| Atlas connection fails | Check the Atlas database user, URL-encode special password characters, and allow the client IP in the network access list. |
| `npm test` cannot connect | Start MongoDB and verify the test process can reach the database in `MONGODB_URI`. |

## Future improvements

These are possible next steps and are not presented as current functionality:

- Add email verification and password reset.
- Add a production session strategy using secure, HttpOnly cookies.
- Move uploaded photos to managed object storage for deployment.
- Add automated frontend browser tests and accessibility checks.
- Add moderation, report abuse, and retention controls for old reports.
