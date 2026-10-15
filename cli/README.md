# @tryletterhead/cli

The [Letterhead API](https://help.tryletterhead.com) from your terminal. Every API operation is a command, and its
flags are the operation's parameters. The commands are generated from the same API description as
[`@tryletterhead/sdk`](https://www.npmjs.com/package/@tryletterhead/sdk), so the CLI can't drift from the API.

## Install

```sh
npm install -g @tryletterhead/cli
# or run it once without installing
npx @tryletterhead/cli --help
```

Requires Node 18 or later.

## Authenticate

Create an API key in your company's settings in Letterhead, then set it in your environment:

```sh
export LETTERHEAD_API_KEY=<your-company-api-key>
```

You can pass `--api-key` instead, but then the key ends up in your shell history. A company API key can read and
change your whole audience, so keep it out of shared shells and scripts. If your company is on its own Letterhead
tenant, also set `LETTERHEAD_BASE_URL=https://<tenant>.api.tryletterhead.com` (or pass `--base-url`).

## Use

```sh
# Add a contact (or update the one with that email) and tag them
letterhead contacts upsert --email person@example.org --first-name Pat --tag vip

# Tag a list of existing contacts
letterhead tags add-to-contacts --tag webinar-attendee --email a@example.org --email b@example.org

# Any operation, by group and name
letterhead contacts list-tags --limit 10
```

Commands are `letterhead <group> <command>`. `letterhead --help` lists the groups, `letterhead <group> --help` lists
a group's commands, and `letterhead <group> <command> --help` shows a command's flags and the API's own description
of it.

- **Flags** are the operation's path and query parameters and the top-level fields of its request body, in
  kebab-case (`--first-name` for `firstName`). Repeat a flag to send a list (`--tag vip --tag webinar`).
- **`--body`** sends anything else as JSON: `--body '{"customFields":{"plan":"pro"}}'`, `--body @contact.json`, or
  `--body -` to read standard input. A flag wins over the same field in `--body`.
- **Output** is the API's JSON on standard output, pretty-printed (`--compact` for one line). CSV and HTML answers
  are printed as text, and file downloads are written as-is, so redirect them to a file.
- **Exit codes:** `0` done; `1` the API answered with an error (printed to standard error as JSON with its
  `status` and `body`) or the request failed; `2` the command itself was wrong, and nothing was sent.
- **Deletes ask first.** A command that deletes something asks you to type `yes` in a terminal. Anywhere else (a
  script, a CI job, an AI agent) it refuses unless you pass `--yes`, so nothing is deleted by accident.

The few operations that upload a file are not supported yet; use the SDK for those.

## For AI coding agents

The CLI is built to be called by an agent: JSON in and out, errors on standard error with a clear exit code, help
text taken from the API description, and no prompts unless a person is at a terminal. Letterhead's documentation is
also available as Markdown for agents at https://docs.tryletterhead.com/llms.txt.

## License

MIT
