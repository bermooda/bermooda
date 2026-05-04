# CursorStack

A modern, production-ready template for building full-stack React applications using React Router.

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🎉 TailwindCSS for styling
- 📖 [React Router docs](https://reactrouter.com/)

## Getting Started

### Installation

Install the dependencies:

```bash
npm i
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:3000`.

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
# For npm
docker build -t cursor-stack .

# Run the container
docker run -p 3000:3000 cursor-stack

# Run the container without LiteFS
docker run -p 8081:8081 -p 8080:8080 --env-file .env -e DATABASE_URL=file:/app/sqlite.db cursor-stack npm run start
```

### Deploying to Fly.io

Prior to your first deployment, you'll need to do a few things:

1. [Install Fly](https://fly.io/docs/getting-started/installing-flyctl/).

   > **Note**: Try `flyctl` instead of `fly` if the commands below won't work.

2. Sign up and log in to Fly:

   ```sh
   fly auth signup
   ```

   > **Note**: If you have more than one Fly account, ensure that you are signed
   > into the same account in the Fly CLI as you are in the browser. In your
   > terminal, run `fly auth whoami` and ensure the email matches the Fly
   > account signed into the browser.

3. Create two apps on Fly, one for staging and one for production:

   ```sh
   fly apps create [YOUR_APP_NAME]
   fly apps create [YOUR_APP_NAME]-staging
   ```

   > **Note**: Make sure this name matches the `app` set in your `fly.toml`
   > file. Otherwise, you will not be able to deploy.

4. Initialize Git.

   ```sh
   git init
   ```

- Create a new [GitHub Repository](https://repo.new), and then add it as the
  remote for your project. **Do not push your app yet!**

  ```sh
  git remote add origin <ORIGIN_URL>
  ```

5. Add secrets:

- Add a `FLY_API_TOKEN` to your GitHub repo. To do this, go to your user
  settings on Fly and create a new
  [token](https://web.fly.io/user/personal_access_tokens/new), then add it to
  [your repo secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
  with the name `FLY_API_TOKEN`.

- Add all environment variables to your fly app secrets, to do this you can run the following command:

  ```sh
  fly secrets import < .env
  ```

- OPTIONAL:Add a `SESSION_SECRET` and `HONEYPOT_SECRET` to your fly app secrets, to do
  this you can run the following commands:

  ```sh
  fly secrets set SESSION_SECRET=$(openssl rand -hex 32) HONEYPOT_SECRET=$(openssl rand -hex 32) --app [YOUR_APP_NAME]
  fly secrets set SESSION_SECRET=$(openssl rand -hex 32) HONEYPOT_SECRET=$(openssl rand -hex 32) --app [YOUR_APP_NAME]-staging
  ```

  > **Note**: If you don't have openssl installed, you can also use
  > [1Password](https://1password.com/password-generator) to generate a random
  > secret, just replace `$(openssl rand -hex 32)` with the generated secret.

- OPTIONAL:Add a `ALLOW_INDEXING` with `false` value to your non-production fly app
  secrets, this is to prevent duplicate content from being indexed multiple
  times by search engines. To do this you can run the following commands:

  ```sh
  fly secrets set ALLOW_INDEXING=false --app [YOUR_APP_NAME]-staging
  ```

6. Create production database:

   Create a persistent volume for the sqlite database for both your staging and
   production environments. Run the following (feel free to change the GB size
   based on your needs and the region of your choice
   (`https://fly.io/docs/reference/regions/`). If you do change the region, make
   sure you change the `primary_region` in fly.toml as well):

   ```sh
   fly volumes create data --region syd --size 1 --app [YOUR_APP_NAME]
   fly volumes create data --region syd --size 1 --app [YOUR_APP_NAME]-staging
   ```

7. Attach Consul:

- Consul is a fly-managed service that manages your primary instance for data
  replication
  ([learn more about configuring consul](https://fly.io/docs/litefs/getting-started/#lease-configuration)).

  ```sh
  fly consul attach --app [YOUR_APP_NAME]
  fly consul attach --app [YOUR_APP_NAME]-staging
  ```

8. Set up Tigris object storage:

   ```sh
   fly storage create --app [YOUR_APP_NAME]
   fly storage create --app [YOUR_APP_NAME]-staging
   ```

   This will create a Tigris object storage bucket for both your production and
   staging environments. The bucket will be used for storing uploaded files and
   other objects in your application. This will also automatically create the
   necessary environment variables for your app. During local development, this
   is completely mocked out so you don't need to worry about it.

9. Commit!

CursorStack comes with a GitHub Action that handles automatically
deploying your app to production and staging environments.

Now that everything is set up you can commit and push your changes to your
repo. Every commit to your `main` branch will trigger a deployment to your
production environment, and every commit to your `dev` branch will trigger a
deployment to your staging environment.

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

## Google OAuth Setup

To enable Google authentication, you need to set up the following environment variables:

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google API
3. Create OAuth credentials:
   - Go to "Credentials" → "Create Credentials" → "OAuth client ID"
   - Select "Web application" as the application type
   - Add authorized redirect URIs:
     - For development: `http://localhost:3000/auth/callback/google`
     - For production: `https://[app].fly.dev/auth/callback/google`
4. Copy the Client ID and Client Secret

Add these environment variables to your `.env` file:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

## Authentication

Make sure to set a strong `BETTER_AUTH_SECRET` environment variable in production.
