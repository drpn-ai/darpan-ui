import { lookupAction } from './mascotActions'

/**
 * What the mascot is allowed to explain.
 *
 * Every entry has to land in three lines of the dock bubble. That ceiling is the
 * point rather than a limitation: there is only room to say what a number IS, not
 * how it is computed, which is the thing operators actually get wrong. If a phrase
 * will not fit, the phrase is wrong.
 *
 * Keys are stable ids, not labels — a column can be renamed without silently
 * detaching its explanation.
 */
export interface GlossaryEntry {
  /** Shown as the bubble's lead, in the reader's own vocabulary. */
  title: string
  /** One sentence. Under thirty words. */
  body: string
  /**
   * Reached only through `v-explain`, never by its title. For a word that means different things on
   * different forms — Username, Password, Host, Expires, Name, Time — a title in the shared index
   * would answer every unmarked use with this one place's meaning (DAR-UI-103).
   */
  byDirectiveOnly?: true
}

export const MASCOT_GLOSSARY: Readonly<Record<string, GlossaryEntry>> = Object.freeze({
  comparedCount: {
    title: 'Compared',
    body: 'every record the run actually looked at, after exclusions. The overlap, not either system’s total — those are always bigger.',
  },
  differenceCount: {
    // DAR-UI-103. reconcile#RuleSetCompareScope (the path every saved run, automation and audit takes)
    // sets differenceCount = missing either side + one row per rule a matched pair failed + duplicate ids.
    // The legacy mapping path has no rules, so the same sentence holds with zero rule rows there.
    title: 'Differences',
    body: 'records missing on either side, plus one for every rule a matched pair failed, plus duplicate ids. A record failing two rules counts twice — it is not a record count.',
  },
  onlyInFile1Count: {
    title: 'Only in the first source',
    body: 'records the first source turned up that the second has never heard of, inside this run’s window. Check the window before chasing them — usually that is the answer.',
  },
  onlyInFile2Count: {
    title: 'Only in the second source',
    body: 'the same story the other way round, inside this run’s window. The second has them; the first does not.',
  },
  runStartedAt: {
    // {detail} is filled by describeTimeZone() from the actual value, because the useful
    // answer is which zone THIS time is in — not a lecture about timezones. It replaces
    // the code that used to be appended to every timestamp in the product.
    title: 'Run started',
    body: 'shown in {detail}, not the server’s clock. Ask me on any other timestamp and I will tell you the same thing.',
  },
  ruleSet: {
    title: 'Rule set',
    body: 'which fields are matched, how records are keyed, and what is excluded. Change it and re-run; a finished run records what was true then, not a draft.',
  },
  automationSchedule: {
    title: 'Schedule',
    body: 'when this automation wakes up on its own. Nothing to do with which records it then looks at — that is the window, just below.',
  },
  automationWindow: {
    title: 'Window',
    body: 'how far back each run reaches for records. A record dated just outside it reads as missing when both systems have it. The most common false alarm here.',
  },
  runStatus: {
    title: 'Status',
    body: 'where the run got to. Finished is not the same as clean — read it next to the counts.',
  },
  scheduledDate: {
    title: 'Scheduled',
    body: 'when the run was meant to start. If it sat here a while before starting, something upstream was busy.',
  },
  completedDate: {
    title: 'Completed',
    body: 'when the run stopped, shown in {detail}. Blank means it has not stopped — which is not the same as it having failed.',
  },
  timestamp: {
    title: 'This time',
    body: 'is shown in {detail}. The same instant reads differently in each zone, and neither is wrong.',
  },
  previousRun: {
    title: 'Previous run',
    body: 'the last time this automation actually went. Further back than the schedule implies means something skipped.',
  },
  nextRun: {
    title: 'Next run',
    body: 'when it is due to go again, in your zone. Paused means no next run — not a late one.',
  },

  /* ── Straight from darpan-docs/reference/glossary.mdx, so the product and the docs
     cannot drift into describing the same word two ways. ───────────────────────── */
  savedRun: {
    title: 'Saved run',
    body: 'the reusable setup tying sources, schemas, primary IDs and rules together. Executions are instances of it.',
  },
  reconciliationRun: {
    title: 'Reconciliation run',
    body: 'one execution of a reconciliation. Finished ones are a record of what was true then — re-run rather than editing.',
  },
  schema: {
    title: 'Schema',
    body: 'the saved definition of a source’s shape. Nothing downstream can compare a field that does not appear here.',
  },
  connection: {
    title: 'Connection',
    body: 'a saved external system or provider setup. Credentials live here, not in the run.',
  },
  generatedOutput: {
    title: 'Generated output',
    body: 'the files or records a workflow or run produced. This is what you download; the counts above are what it contains.',
  },
  sourceStrategy: {
    title: 'Source strategy',
    body: 'how inputs get selected or loaded for a run — uploaded, fetched, or pulled from a connection.',
  },
  activeTenant: {
    title: 'Active tenant',
    body: 'the tenant every read and write is scoped to. Switching it re-points your other tabs too, so check it before you blame the data.',
  },
  matched: {
    title: 'Matched',
    body: 'corresponding records found on both sides with no relevant difference. The boring, desirable outcome.',
  },
  valueMismatch: {
    title: 'Value mismatch',
    body: 'a matched record whose fields differ. Both systems have it; they disagree about it.',
  },
  missingInSource: {
    title: 'Missing in source',
    body: 'in one source, not the other. Verification and suppression already dropped the ones that were never real.',
  },
  processingError: {
    title: 'Processing error',
    body: 'the run could not parse, compare or output part of the data. Counts below this are incomplete rather than clean.',
  },

  /* ── The vocabulary the app actually puts on screen ───────────────────────────
     Counted from the templates rather than imagined: most labels in this product are
     connection and setup fields, not run counts. A glossary of run terms alone left
     entire pages with nothing to ask about. ─────────────────────────────────── */
  timezone: {
    // Wording follows darpan-docs/guides/manage-tenant-settings.mdx.
    title: 'Timezone',
    body: 'this tenant’s default reading of dates and times, for workflows, schedules and windows. Everyone on it sees the same one.',
  },
  systemLabel: {
    title: 'System',
    body: 'which external system this side is. When both sides are the same system, these labels tell the instances apart.',
  },
  activeFlag: {
    title: 'Active',
    body: 'whether this runs on its own. Turning it off stops the schedule and keeps the setup — nothing is deleted.',
  },
  primaryId: {
    title: 'Primary ID',
    body: 'the field records are matched on. Pick one stable and unique, or every run disagrees with itself.',
  },
  endpoint: {
    title: 'Endpoint',
    body: 'the specific call this side fetches from. The connection says which system; this says which door.',
  },
  sourceField: {
    title: 'Field',
    body: 'one field inside the source, as the schema named it. Only fields the schema knows about can be compared.',
  },
  baseUrl: {
    title: 'Base URL',
    body: 'the root address every request is built on. A trailing path here quietly changes every endpoint below it.',
  },
  tokenUrl: {
    title: 'Token URL',
    body: 'where Darpan trades its signed key for a short-lived sign-in token. A wrong account number here fails every call before any data is read.',
  },
  netSuiteScope: {
    title: 'Scope',
    body: 'which NetSuite doors the token opens. RESTlets reach custom scripts, REST Web Services reach SuiteQL; drop one and those calls come back refused.',
  },
  authType: {
    title: 'Auth Type',
    body: 'how Darpan proves who it is to this system. Change it and the credentials below change with it.',
  },
  apiVersion: {
    title: 'API Version',
    body: 'which version of the remote API to speak. Pinned deliberately — a system that moves on can rename fields your schema still expects.',
  },
  configId: {
    title: 'Config ID',
    body: 'the identifier of this saved setup. Useful when a run names a config rather than a system, and when someone asks which one broke.',
  },
  webhookUrl: {
    title: 'Webhook URL',
    body: 'where notifications are posted. Anyone holding this can post into that space, so treat it as a credential.',
  },
  timeoutSeconds: {
    title: 'Timeout',
    body: 'how long to wait on this system before giving up. Too short turns a slow source into a failed run; too long hides one.',
  },
  sharedWith: {
    title: 'Shared with',
    body: 'the other tenants allowed to use this configuration. Sharing grants use of the setup, not sight of the data a run produces.',
  },
  permissions: {
    title: 'Permissions',
    body: 'what this account may do inside the active tenant. Access is scoped per tenant, so the same person can differ between them.',
  },
  runName: {
    title: 'Run name',
    body: 'what you search for later. Ask Darpan finds runs by this and by output file name, so be specific.',
  },
  startDate: {
    title: 'Start date',
    body: 'the beginning of the window this run reaches back to. A record dated just before it looks missing even when both systems hold it.',
  },
  updatedAt: {
    title: 'Updated',
    body: 'when this record last changed, in your zone. Not when the data it describes changed.',
  },
  remoteAttributes: {
    title: 'Remote attributes',
    body: 'extra values passed through to the remote system on each call. Wrong ones fail quietly as an empty extract rather than an error.',
  },

  /* ── Section headings ─────────────────────────────────────────────────────────
     The first thing anybody lost on a page reads is the heading over the region, so
     it is the cheapest possible place to answer "what am I looking at". ───────── */
  exclusions: {
    // Not a filter on the comparison: these are pushed to the connector as filter parameters,
    // so filtered records are never fetched in the first place. A side that cannot filter at
    // the source has none at all, which is why the board says so when you try — see
    // RuleSetBoard's "cannot filter records at the source".
    title: 'Filters',
    body: 'rules for which records a source pulls at all — either excluding the values you list or keeping only those. What a filter leaves out never arrives, so it cannot show up as a difference.',
  },
  // The Automations page titles this list “Automation Runs”, which reads like a run
  // history and is not one — every tile under it is a saved automation. Kept as its own
  // entry rather than pointed at previousRuns for exactly that reason.
  automations: {
    title: 'Automations',
    body: 'the saved runs set to go off on their own, one tile each. Open one for its schedule, its window, and what it has actually been doing.',
  },
  // The run result page's own vocabulary. These four existed nowhere, which is why a
  // sweep of that page resolved nothing at all — see mascotTargets.page.spec.ts.
  sourceFiles: {
    title: 'Source files',
    body: 'the two extracts this run compared, exactly as they arrived. Download one to check a record the run says is missing.',
  },
  apiDateRange: {
    title: 'API date range',
    // {detail} is the exact pair of instants, filled by the page from the run's own
    // window. The label beside it is only a calendar day, resolved in the viewer's zone,
    // so the instants are the part that settles which records were really in scope.
    body: 'the window this run pulled: {detail}.',
  },
  runSteps: {
    title: 'Run steps',
    body: 'each stage this run went through and how it ended. A step that failed explains a count below it better than the count does.',
  },
  diffDetail: {
    title: 'Diff detail',
    body: 'what actually differs on this record \u2014 the fields, and what each side holds. The counts say how many; this says what.',
  },
  previousRuns: {
    title: 'Previous runs',
    body: 'every execution of this automation, newest first. Each is a record of what was true when it went — re-run rather than editing one.',
  },
  previousResults: {
    title: 'Previous results',
    body: 'the reviewable output of earlier runs. The run is the execution; the result is what it left behind.',
  },
  savedSchemas: {
    title: 'Saved schemas',
    body: 'the source shapes this tenant has defined. A run can only compare fields that appear in one of these.',
  },
  savedRuns: {
    title: 'Saved runs',
    body: 'the reusable setups — sources, schemas, primary IDs and rules — that executions are instances of.',
  },
  savedConfigs: {
    title: 'Saved configs',
    body: 'connection setups this tenant can point a run at. One config, many runs.',
  },
  endpoints: {
    title: 'Endpoints',
    body: 'the specific calls available on this connection. The connection is the system; these are the doors into it.',
  },
  tenantContext: {
    title: 'Tenant context',
    body: 'which tenant everything on this page is scoped to. It is a server-side preference, so switching it re-points your other tabs as well.',
  },
  localization: {
    title: 'Localization',
    body: 'how this tenant reads dates and times. Set it before the first automated run, or the team reads timestamps in the wrong zone.',
  },
  runTypeSync: {
    title: 'Sync run',
    body: 'checks that two systems hold the same records. Healthy is zero — anything it finds is a record that never made it across, or arrived wrong.',
  },
  runTypeLifecycle: {
    title: 'Lifecycle run',
    body: 'follows records through a chain of questions and names where each one stalls. Never zero — watch which stall grows.',
  },
  runTypeAudit: {
    title: 'Audit run',
    body: 're-checks a list of what must be true with sync and lifecycle checks, and keeps each finding open until a later run clears it. A fix counts when a run sees it, not when someone says so.',
  },
  pinnedRuns: {
    title: 'Pinned runs',
    body: 'the runs you asked to keep at the top. Pinning changes what you see first, never what a run does.',
  },
  activity: {
    title: 'Activity',
    body: 'what happened here recently, newest first. A quiet list is not the same as a healthy one.',
  },
  operations: {
    title: 'Operations',
    body: 'the actions you can take on this record. Anything here changes something; reading is everywhere else on the page.',
  },

  /* ── Run results (DAR-UI-103) ─────────────────────────────────────────────────── */
  validationMessages: {
    title: 'Validation messages',
    body: 'where a source file broke its schema. Counts read from a file that failed here cannot be trusted — fix the file or the schema, then re-run.',
  },
  processingWarnings: {
    title: 'Processing warnings',
    body: 'what the run noticed and worked around — a guessed file type, a rule that failed on one batch. If one says differences were dropped, the result is incomplete.',
  },
  conclusionChecks: {
    title: 'How Darpan concluded',
    body: 'the facts Darpan checked before naming this cause, and each one held. If any of them looks wrong to you, so is the cause.',
  },
  conclusionDecision: {
    title: 'Needs a decision',
    body: 'a cause Darpan thinks may be expected, not a fault. Stop flagging it in the rules board, or keep flagging and it shows up again next run.',
  },
  lifecycleNotFinding: {
    title: 'Not a finding',
    body: 'records here still show, but this place was marked an expected stop, so they do not count toward Findings. Mark it a finding again if it starts meaning trouble.',
  },
  flowchartFindings: {
    // Same word as the audit's Findings, different thing — the flowchart page points here with v-explain.
    title: 'Findings',
    body: 'records this run left somewhere they should not be — each lifecycle place’s records, or a chart’s “no” answers. Not meant to reach zero; watch which one grows.',
  },

  /* ── The audit report (DAR-UI-103) ────────────────────────────────────────────── */
  auditHealth: {
    title: 'Today’s run',
    body: 'what this morning’s audit read and whether it can be trusted. Anything partial here closed nothing, so read this before believing a quiet findings list.',
  },
  auditRunningNow: {
    title: 'Running now',
    body: 'checks still working this morning. Findings arrive as each one finishes, so the counts climb until the last is done — wait before reading them.',
  },
  auditStatements: {
    title: 'Statements',
    body: 'what this tenant needs to be true, in its own words. Each is tested by checks; one with no check is not covered, which is not the same as passing.',
  },
  auditCheck: {
    title: 'Check',
    body: 'one comparison that tests a statement. Ran means every read was complete; partial found what it could and closed nothing, so open findings stay open.',
  },
  auditNotCovered: {
    title: 'Not covered',
    body: 'statements no check reads. They are not passing; nothing is looking. Add a check, or the audit stays silent about them.',
  },
  auditFindings: {
    title: 'Findings',
    body: 'one record breaking one statement each. It stays open run after run until a complete check stops reporting it — a fix counts when a run sees it.',
  },
  auditRecords: {
    title: 'Records',
    body: 'how many records this source handed over on its last read. A sharp drop from yesterday is worth checking before trusting today’s findings.',
  },
  auditRead: {
    title: 'Read',
    body: 'when the data behind this was read — for a source, the moment it was pulled; for a check, the days it covered. Nothing outside that is on this report.',
  },
  auditAffects: {
    title: 'Affects',
    body: 'the statements whose checks read this source. While it is not complete, their findings cannot close — open ones stay open.',
  },
  auditStuckOn: {
    title: 'Stuck on',
    body: 'the one thing holding this record up, read from the systems themselves. Clear it and the next run closes the finding on its own.',
  },
  auditDoThis: {
    title: 'Do this',
    body: 'the fix for this cause and who owns it. Doing it is half the job: the finding closes when a later run sees the records line up.',
  },
  auditLines: {
    title: 'Lines',
    body: 'this order’s lines; the outlined one is what holds the order up. Start there — the others are shown for context.',
  },
  auditEvidence: {
    title: 'Evidence',
    body: 'the tests run on this one record, passed out of total. The failed ones are why it is a finding; they show only when no cause explains it.',
  },
  auditHistory: {
    title: 'History',
    body: 'every time this finding was found, reopened or closed, and by whom. One that keeps coming back points at a sync, not a one-off mistake.',
  },
  auditGrace: {
    title: 'Grace',
    body: 'how long a new finding waits as pending before it counts as open, to ride out normal sync lag. Too long, and real problems hide that long too.',
  },
  auditMatchedBy: {
    title: 'Matched by',
    body: 'the shared id this check joins the two systems on. A record missing that id on one side can only ever read as missing, never as a mismatch.',
  },

  /* ── Automation dashboard, connections, config (DAR-UI-103) ───────────────────── */
  automationSetup: {
    title: 'Setup',
    body: 'everything a scheduled run of this automation uses. Changes apply from the next run; finished runs keep what was true when they ran.',
  },
  automationBasedOn: {
    title: 'Based on',
    body: 'the saved run this automation copied its sources and filters from. It runs its own copy, so a later edit to that run reaches it only when you sync.',
  },
  automationId: {
    title: 'Automation ID',
    body: 'how Darpan refers to this automation in logs, chat messages and the CLI. The name can change and this cannot, so quote it when asking for help.',
  },
  connectionDiagnostics: {
    title: 'Diagnostics',
    body: 'this connection, tried one step at a time and shown as each finishes. The first step that fails is the one to fix.',
  },
  configHistory: {
    title: 'Config history',
    body: 'every saved version of this tenant’s setup. Restoring one puts that setup back; runs that already finished keep the results they had.',
  },

  /* ── Setup forms: connections, settings, scripts, automations, audits (DAR-UI-103) ── */
  configDescription: {
    title: 'Description',
    body: 'the name this setup goes by in lists and pickers. Left blank, people choose between bare IDs.',
  },
  connectionUsername: {
    title: 'Username',
    body: 'the account Darpan signs in as, for sign-ins that use one. Every call it makes runs under this name, with that account’s access.',
    byDirectiveOnly: true,
  },
  omsUsername: {
    title: 'Username',
    body: 'the HotWax account Darpan signs in as for Basic sign-in. It is never shown back, and for now a Basic save needs it typed again.',
    byDirectiveOnly: true,
  },
  connectionPassword: {
    title: 'Password',
    body: 'sent with the username as a Basic sign-in on every call. Stored encrypted and never shown back, so an empty box on edit is normal.',
    byDirectiveOnly: true,
  },
  sftpPassword: {
    title: 'Password',
    body: 'tried before the private key, and a blank one keeps the saved one. Once a password exists, this form cannot switch the server to key sign-in.',
    byDirectiveOnly: true,
  },
  sftpPrivateKey: {
    title: 'Private Key',
    body: 'used only when no password is saved; once one is, this key is never tried. Stored encrypted and never shown back.',
  },
  sftpHost: {
    title: 'Host',
    body: 'the server’s address. A path after it (host/inbound) becomes the folder runs read, unless the automation names its own.',
    byDirectiveOnly: true,
  },
  sftpPort: {
    title: 'Port',
    body: 'the server’s SSH port, 22 when empty. A port written into Host (host:2222) overrides this one.',
  },
  apiToken: {
    title: 'API Token',
    body: 'sent as a bearer token on every call. Stored encrypted and never shown back. Revoke it at the source and every run using it fails.',
  },
  omsApiKey: {
    title: 'API Key',
    body: 'sent in HotWax’s api_key header on every call, not as a bearer token. Stored encrypted and never shown back.',
  },
  netSuiteClientId: {
    title: 'Client ID',
    body: 'the integration’s ID from NetSuite’s M2M setup, sent as the sign-in’s issuer. Swapped with Cert ID, every token request is refused.',
  },
  netSuiteCertId: {
    title: 'Cert ID',
    body: 'the certificate ID from NetSuite’s M2M mapping, sent as the key ID. Swapped with Client ID, every token request is refused.',
  },
  netSuitePrivateKeyPem: {
    title: 'Private Key PEM',
    body: 'signs each sign-in request. It must be a PKCS#8 RSA or EC key matching the Cert ID’s certificate. Stored encrypted.',
  },
  netSuiteEndpointUrl: {
    title: 'Endpoint URL',
    body: 'the exact address every call through this endpoint goes to. GET calls add item, location and dates to it as query values.',
  },
  httpMethod: {
    title: 'HTTP Method',
    body: 'the verb each call uses. POST and PUT carry the item list in the body; GET fits one item per call, so a bulk lookup on GET fails.',
  },
  netSuiteAuthConfig: {
    title: 'Auth Config',
    body: 'the saved NetSuite sign-in this endpoint uses. An inactive one will not save here, and one in use here cannot be deleted.',
  },
  headersJson: {
    title: 'Headers JSON',
    body: 'extra headers added to every call, as one JSON object. Stored as plain text, unlike the sign-in’s secrets, so keep tokens out of it.',
  },
  shopifyAccessToken: {
    title: 'Access Token',
    body: 'sent with every Shopify call. Stored encrypted and never shown back. A revoked token fails every Shopify run until it is replaced here.',
  },
  endpointAccess: {
    title: 'Available Endpoints',
    body: 'which calls runs may make through this connection. Untick one and any run needing it stops as not enabled. New ones start ticked.',
  },
  aiConfiguration: {
    title: 'AI Configuration',
    body: 'one setting for every tenant on this Darpan, not just this one. Only a Darpan admin can save it.',
  },
  aiApiKey: {
    title: 'API Key',
    body: 'stored encrypted and never shown back, only whether one exists. Blank keeps the current key; this form cannot clear it.',
    byDirectiveOnly: true,
  },
  aiProvider: {
    title: 'Provider',
    body: 'which AI company Darpan asks, OpenAI or Gemini. Saving a provider’s settings makes it the active one for the whole instance.',
  },
  aiModel: {
    title: 'Model',
    body: 'which model this provider is asked for. Left blank, the last saved model stays, or the provider default if none was saved.',
  },
  slackBotToken: {
    title: 'Bot user OAuth token',
    body: 'the xoxb- token Darpan posts to Slack with. Checked with Slack before saving, then stored encrypted. Anyone holding it can write to that workspace.',
  },
  chatProduct: {
    title: 'Chat product',
    body: 'which service this space posts through, Google Chat or Slack. It cannot change once saved, so moving a space to the other product means adding a new space.',
  },
  chatSpace: {
    title: 'Chat space',
    body: 'a named destination: one Google Chat webhook or one Slack channel, set up in tenant settings. Change where it posts there and everything using it follows.',
  },
  slackChannel: {
    title: 'Slack channel',
    body: 'where this space’s messages land. A private channel needs the Darpan bot invited before it can post there.',
  },
  chatSpaceName: {
    title: 'Space name',
    body: 'what every picker calls this destination: automations, scripts, your own notification default. Two alike are easy to mix up.',
  },
  accountPassword: {
    title: 'Password',
    body: 'changing it signs this account out everywhere else, CLI sign-ins included. The session you are in stays.',
    byDirectiveOnly: true,
  },
  accountUsername: {
    title: 'Username',
    body: 'what you type to sign in. This page cannot change it.',
    byDirectiveOnly: true,
  },
  displayName: {
    title: 'Display name',
    body: 'what the top bar shows beside the tenant name. Left blank, your username shows instead.',
  },
  recoveryEmail: {
    title: 'Recovery email',
    body: 'where password reset codes go. With none set, Forgot password cannot reach you. Changing it asks for your current password first.',
  },
  userId: {
    title: 'User ID',
    body: 'how Darpan records you on the runs you start. Unlike your display name it never changes, so quote it to an admin.',
  },
  lastLogin: {
    title: 'Last Login',
    body: 'the newest successful sign-in to this account, usually this one. A time you do not recognise is worth a password change.',
  },
  lastRun: {
    title: 'Last Run',
    body: 'the id of the newest run you started in the active tenant. Switch tenant and it changes; runs other people started never show here.',
  },
  userNotificationDefault: {
    title: 'Notifications',
    body: 'your own chat space, offered as “My default space” when you pick where an automation posts.',
    byDirectiveOnly: true,
  },
  cliSessionHost: {
    title: 'Host',
    body: 'the computer name the CLI gave when it signed in. Darpan does not check it, so revoke any you do not recognise.',
    byDirectiveOnly: true,
  },
  cliSessionSignedIn: {
    title: 'Signed in',
    body: 'when this terminal was approved. Revoke ends it now; a password change ends every one.',
  },
  cliSessionExpires: {
    title: 'Expires',
    body: 'after this the terminal has to run darpan login again. Revoke or a password change ends it sooner.',
    byDirectiveOnly: true,
  },
  cliCodeExpires: {
    title: 'Expires',
    body: 'this code stops working ten minutes after the terminal asked. Past that, run darpan login again for a fresh one.',
    byDirectiveOnly: true,
  },
  cliCodeStarted: {
    title: 'Started',
    body: 'when a terminal asked to sign in as you. If you did not just run darpan login, deny it.',
    byDirectiveOnly: true,
  },
  cliSignInRequest: {
    title: 'Sign-in request',
    body: 'a terminal asking to act as you, under a name it chose itself. Approving gives it your permissions until it expires.',
  },
  cliAccess: {
    title: 'CLI access',
    body: 'whether the Darpan CLI may act for you in this tenant. It is set per tenant, and a Darpan admin turns it on, pauses or ends it.',
    byDirectiveOnly: true,
  },
  scriptName: {
    title: 'Name',
    body: 'must be unique in this tenant. A second script with the same name is refused when you save.',
    byDirectiveOnly: true,
  },
  scriptProfile: {
    title: 'Profile',
    body: 'how much a script may do: an Expression is one line with no loops and gets 250 ms; a Script allows both and gets 2 s. A body that does not fit is refused on save.',
    byDirectiveOnly: true,
  },
  scriptBody: {
    title: 'Script',
    body: 'the JEXL that reads its input and returns the text to post. Return nothing and nothing is sent; pass the time limit and the run stops.',
  },
  scriptSchedule: {
    title: 'Schedule',
    body: 'when this script runs, read in the tenant’s timezone in brackets, not your own. A teammate in another zone sees a different clock time for the same post.',
    byDirectiveOnly: true,
  },
  scriptPostTo: {
    title: 'Post to',
    body: 'the chat space this script’s text goes to. If the space is deleted, switched off or has no webhook, the run reads Not delivered.',
  },
  scriptInputRun: {
    title: 'Reads the newest result of',
    body: 'the saved run whose latest finished result feeds the script each time. With no finished result yet, nothing is sent.',
  },
  automationSftpServer: {
    title: 'SFTP Server',
    body: 'the saved server and login this side reads its file from on every run. Change the login there and every automation using it changes too.',
    byDirectiveOnly: true,
  },
  automationRemotePath: {
    title: 'Remote path',
    body: 'the folder each run reads: it takes the newest file there, then moves it into an archive subfolder so the next run cannot compare it twice.',
    byDirectiveOnly: true,
  },
  automationName: {
    title: 'Automation Name',
    body: 'the name every chat message about this automation’s runs carries. Rename it freely; logs and the CLI go by the automation ID.',
  },
  automationChatSpace: {
    title: 'Chat Space',
    body: 'where each finished or failed run is posted, with its difference counts. With no notifications, a failed run is seen only by someone who opens it.',
    byDirectiveOnly: true,
  },
  automationWindowCount: {
    title: 'Count',
    body: 'how many whole days, weeks or months back each run reaches. It stops at the start of today, this week or this month, so the current one is never read.',
    byDirectiveOnly: true,
  },
  automationCustomEnd: {
    title: 'End Date',
    body: 'where a custom window stops. A custom window never moves, so every scheduled run re-reads the same dates and nothing newer is compared.',
  },
  automationScheduleMinute: {
    title: 'Minute',
    body: 'minutes past every hour this fires. The window is cut by calendar day, so every run within one day asks for the same records.',
    byDirectiveOnly: true,
  },
  automationScheduleWeekday: {
    title: 'Day',
    body: 'the weekday this fires, in the timezone beside it. A previous-week window still covers Monday to Sunday, whichever day you pick.',
    byDirectiveOnly: true,
  },
  automationScheduleMonthDay: {
    title: 'Date',
    body: 'the day of the month this fires. Pick 29, 30 or 31 and months without that day are skipped, with no run at all.',
    byDirectiveOnly: true,
  },
  automationScheduleTime: {
    title: 'Time',
    body: 'when this fires, in the timezone beside it, for the whole tenant. Records are picked by date, so moving the hour does not change what a run reads.',
    byDirectiveOnly: true,
  },
  netSuitePreviewDay: {
    title: 'Preview day',
    body: 'the one day this preview pulls. It shapes the preview only, never what the query reads in a run.',
    byDirectiveOnly: true,
  },
  auditName: {
    title: 'Audit name',
    body: 'the title the report and the admin live view show for this audit. Its links use the audit code, so renaming breaks no bookmark.',
    byDirectiveOnly: true,
  },
  auditScheduleDaily: {
    title: 'Daily',
    body: 'on, every check in this audit runs once a day. Off pauses them all, so no findings are recorded or closed until it is back on.',
    byDirectiveOnly: true,
  },
  auditScheduleTime: {
    title: 'Audit time',
    body: 'when every check in this audit starts each day, in the timezone beside it. Saving moves them all here, even checks that ran at other times.',
    byDirectiveOnly: true,
  },
  auditRunEmail: {
    title: 'Email after each run',
    body: 'an email to everyone with access to this tenant once each run finishes. Off, findings still record but nobody is told.',
  },
  auditRunEmailExtra: {
    title: 'Also send to',
    body: 'addresses beyond this tenant’s members that get the same email, such as a client’s inbox. Only tenant admins can change the list.',
  },
  auditCheckRecordType: {
    title: 'Record type',
    body: 'the type findings file this side’s record under, such as return or creditMemo. Blank reads as record, and it names the record in the default headline.',
    byDirectiveOnly: true,
  },
  auditCheckName: {
    title: 'Check name',
    body: 'what this check compares, in a few words. It ends the default headline, and the check ID follows it until you type one.',
    byDirectiveOnly: true,
  },
  auditCheckId: {
    title: 'Check ID',
    body: 'this check’s id in the audit report’s JSON, unique in the tenant. It follows the name until you type one; an id already taken is refused.',
  },
  auditExpectedCauses: {
    title: 'Expected causes',
    body: 'causes that are normal for this run; records they explain count toward no statement. Set on the run, so every check using it changes too.',
  },
  auditFixOwner: {
    title: 'Fix owner',
    body: 'the team each finding of this check names as its fixer, such as HotWax Support. It is who a reader forwards the finding to.',
  },
  auditFixWhere: {
    title: 'Fix where',
    body: 'the system each finding says to fix it in: OMS, NetSuite or Shopify. Darpan only points there; it never writes to those systems.',
  },
  auditCheckCurrency: {
    title: 'Currency',
    body: 'set only when the rule compares money: the first side’s value becomes the expected amount and the second the actual. Blank, they stay plain values.',
  },
  auditExpectedSource: {
    title: 'Expected from',
    body: 'where the first side’s amount comes from, such as an RMA total. It shows beside the expected figure, so readers know which number is the reference.',
  },
  auditActualSource: {
    title: 'Actual from',
    body: 'where the second side’s amount comes from, such as a NetSuite credit memo total. It shows beside the actual figure on each money finding.',
  },
  auditHeadline: {
    title: 'Headline',
    body: 'the one line each finding opens with, filled per record ({recordKey} is its id). Blank uses the record type, id and this check’s name.',
  },
})

/** Null rather than a throw: a missing phrase is a content gap, not a crash. */
/**
 * One lookup over two registries. Nouns are keyed by stable id, actions by the control's
 * own name, so the two key spaces cannot collide and the caller does not have to know
 * which kind of question it asked.
 */
export function lookupGlossary(term: string | null | undefined): GlossaryEntry | null {
  if (!term) return null
  return MASCOT_GLOSSARY[term] ?? lookupAction(term)
}
