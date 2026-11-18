# Windows local sandbox setup preparation — Phase G2C-1

Prepared29 October2026. **Instructions only: no provisioning, executable discovery, port/firewall inspection, secret generation, connection, replica initiation, service/listener startup or shutdown was executed.** No MongoDB installation is assumed. The previous427 backend/354 frontend/129 assessment/185 syntax/build baseline is historical, not rerun for this documentation-only change.

## 1. Review findings and decisions required first

Reviewed PHASE_G2B_FINAL_PREFLIGHT.md, PHASE_G2B_EXECUTION_PLAN.json, PHASE_G2B_SANDBOX_PROPOSAL.md and server/tests/integration/README.md. The following gaps must not be silently resolved by an installation:

| Finding | Consequence / approval gate |
|---|---|
|Literal127.0.0.1 replica member vs MongoDB hostname checks|MongoDB5+ rejects IP-address configurations in replica-set initiation/reconfiguration by default. Keeping the existing member tuple requires a version-pinned, development-only disableSplitHorizonIPCheck decision. Otherwise revise the plan AND validators/adapters/tests for a pinned hostname; do not silently use localhost. This guide shows the exception as a placeholder, not an approved setting. [MongoDB parameter reference](https://www.mongodb.com/docs/v8.0/reference/parameters/#mongodb-parameter-param.disableSplitHorizonIPCheck)|
|Authenticated replica set needs membership authentication|authorization:enabled alone is insufficient preparation: supply a private replica keyfile, restrict its Windows ACL and retain auth throughout bootstrap. Windows does not enforce keyfile permission checks for you. [MongoDB keyfile setup](https://www.mongodb.com/docs/v8.0/tutorial/deploy-replica-set-with-keyfile-access-control/)|
|Earlier sandbox-only policy lacks operator bootstrap exception|First-user setup, replica administration and shutdown use the local admin command database; the server also maintains its internal local/admin state. This needs explicit **operator-only metadata/provisioning approval on the NEW dedicated instance**. Harness business access remains only hnc_step15q_sandbox. If that exception is not approved, stop. Nothing permits accessing production test|
|Mock role is not an actual least-privilege grant|Current flat action receipts cannot attest collection-specific audit restrictions or real grants. Runtime writer, metadata inspector and human provisioner must be separate. Do not use built-in readWrite/root/admin credentials in the harness|
|Host loopback is not proof of isolation|Use a fresh network-disabled Windows guest with no production files/accounts/tunnels. Host27018 might belong to an existing instance; never reuse or stop it. A firewall allow rule does not establish deny-by-default egress|
|Connection limits describe different scopes|Proposed server cap16 includes administrative/internal clients; existing proposed harness cap8 includes monitoring and pool5. Neither is a RAM/CPU limit, and monitoring overhead needs version-specific verification. Windows job/resource enforcement remains a separate runtime prerequisite|
|Guest RAM and default storage cache can exceed the proposed server budget|The template requires an explicitly approved version-valid WiredTiger cache size. Cache size is not total RSS; a4GiB guest/default cache must not be mistaken for enforcement of the512MiB server budget. If the pinned build cannot fit the resource ceiling, stop for a reviewed budget/runtime decision, never silently raise it|
|Current adapters/runner are mock-only|No actual driver/HTTP runner exists; the offline guard blocks every socket and app.listen is denied. The new samples are not inputs accepted by that strict adapter. Do not weaken the guard or modify production startup|
|Prior command working directory is on the host|G2B examples name D:\spinning wheel comp; an isolated guest uses its sanitized C:\HNC-Source copy. Future executable/plan/dependency hashes and working directory must be reviewed/rebased for the guest. Do not run the host command to compensate; this task leaves the blocked G2B plan unchanged|
|Single-member shutdown differs from a healthy multi-member set|A primary may refuse non-forced shutdown when no secondary can take over. Forced shutdown requires separately approved, verified quiescence; it must not be an automatic fallback. See section9|

The previous plan remains executionReady:false and every live stage remains BLOCKED. This guide does not approve installation, administrator access, metadata exceptions, firewall changes or live integration.

## 2. Command classification

Every block below is **proposed, not run**. Use the classifications when requesting future approval:

- **I — inspection only:** local OS/filesystem metadata, no database or TCP connection, no installation/change. Can require elevation to read policy. A connection test such as Test-NetConnection, curl, Invoke-WebRequest, mongosh without --nodb, or a driver ping is NOT I.
- **P — provisioning/change:** guest launch, directory/ACL/key/config/firewall changes, mongod launch. Requires exact scope approval first.
- **C — connected operation:** any shell/driver connection, even reading status/users/indexes; includes replica/user/role changes. Requires dedicated target and command approval before execution.
- **S — shutdown:** owned-handle/service termination. Requires run/instance identity and shutdown approval; no generic service/process killing.
- **D — deletion/cleanup:** not supplied or authorized. Retain files/fixtures; no dropDatabase, deleteMany, Remove-Item, data repair, syncIndexes or wildcard service control.

No executable .ps1, actual .env, key or password is created by this preparation. PowerShell examples target Windows PowerShell5.1+/PowerShell7 on Windows; pinned binary/config option compatibility must be checked separately. JavaScript blocks belong only inside an explicitly connected mongosh session, never PowerShell.

## 3. Isolation layout and prerequisites

Preferred layout: Windows Sandbox with networking disabled, or an independently reviewed dedicated Windows VM with every virtual network adapter disconnected. Both MongoDB and the eventual HTTP harness run **inside that same guest**; guest127.0.0.1 is not host127.0.0.1. No port forwards, shared host credentials or production databases. If the Windows edition/virtualization capability is unavailable, stop and choose an approved equivalent; do not substitute the production workstation namespace.

Stage a reviewed offline bundle first: signed/hash-pinned MongoDB Windows binaries, mongosh (separate distribution), Node/dependencies, sanitized application source and reviewed test files. No automatic download/install command is supplied. Prefer portable binaries; an MSI that installs an auto-start MongoDB service on27017 is outside this procedure. Never map/copy the active project directory wholesale: it can contain .env, backups, customer exports or secrets. Use an exact reviewed staging-file allowlist; no host user profile, credentials, certificates, keys or environment secrets. No browser/email client or other MongoDB instance belongs in the guest.

**P — optional Windows Sandbox configuration to prepare manually, not launch now.** It requires a supported Windows edition/feature and a separately prepared sanitized staging directory. Do not double-click or invoke the .wsb during this step. No logon/startup command is included. The read-only mapping is not a place for DB data or private keys. [Microsoft configuration reference](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-configure-using-wsb-file)

```xml
<Configuration>
  <Networking>Disable</Networking>
  <vGPU>Disable</vGPU>
  <ClipboardRedirection>Disable</ClipboardRedirection>
  <PrinterRedirection>Disable</PrinterRedirection>
  <AudioInput>Disable</AudioInput>
  <VideoInput>Disable</VideoInput>
  <MemoryInMB>4096</MemoryInMB>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>D:\HNC-Sandbox-Staging</HostFolder>
      <SandboxFolder>C:\HNC-Staging</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
  </MappedFolders>
</Configuration>
```

VM4096MiB is a guest ceiling, not permission to exceed the earlier512MiB application/server budgets. Windows Sandbox is disposable: closing it destroys guest contents. Approval must cover evidence export/retention BEFORE closing; never map a writable host project as a shortcut. A persistent dedicated offline VM is an alternative if that lifecycle is unsuitable.

Guest-only paths (never use production/config installation defaults):

| Purpose | Proposed guest path |
|---|---|
|Reviewed binaries/source|C:\HNC-Tools and C:\HNC-Source|
|Dedicated root / data|C:\HNC-Isolated / C:\HNC-Isolated\data|
|Logs / public configuration|C:\HNC-Isolated\logs / C:\HNC-Isolated\conf|
|Private replica key|C:\HNC-Isolated\secrets\replica.key|
|Temporary / nonsecret run receipts|C:\HNC-Isolated\tmp / C:\HNC-Isolated\receipts|

### I — availability, occupancy, binding, firewall and path inspections

These only **write the commands here**, they were not performed on the host. Prefer running them inside the approved guest. Never print arbitrary process command lines or environment contents.

```powershell
# Availability metadata only; no bare executable invocation.
Get-Command mongod.exe, mongosh.exe, node.exe -CommandType Application -All -ErrorAction SilentlyContinue |
  Select-Object Name, Source, Version

# Fill explicit absolute paths from the approved offline bundle; do not guess PATH.
$MongodExe = '<PINNED_ABSOLUTE_MONGOD_EXE>'
$MongoshExe = '<PINNED_ABSOLUTE_MONGOSH_EXE>'
$NodeExe = '<PINNED_ABSOLUTE_NODE_EXE>'
foreach ($file in @($MongodExe, $MongoshExe, $NodeExe)) {
  if ($file.Contains('<') -or -not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw 'A reviewed executable is unavailable; do not install or launch implicitly'
  }
  Get-Item -LiteralPath $file | Select-Object FullName, Length, VersionInfo
  Get-FileHash -LiteralPath $file -Algorithm SHA256
  Get-AuthenticodeSignature -LiteralPath $file | Select-Object Path, Status
}

# Socket table only: observing27017 does NOT connect to or authorize its instance.
Get-NetTCPConnection -State Listen -LocalPort 27017,27018,5501 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, OwningProcess
Get-Service -Name MongoDB -ErrorAction SilentlyContinue | Select-Object Name, Status

# A disconnected guest should have no operational external adapter/route.
Get-NetAdapter | Select-Object Name, Status, InterfaceDescription
Get-NetRoute -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object DestinationPrefix -eq '0.0.0.0/0' |
  Select-Object InterfaceIndex, DestinationPrefix, NextHop
Get-NetRoute -AddressFamily IPv6 -ErrorAction SilentlyContinue |
  Where-Object DestinationPrefix -eq '::/0' |
  Select-Object InterfaceIndex, DestinationPrefix, NextHop
Get-NetFirewallProfile -PolicyStore ActiveStore |
  Select-Object Name, Enabled, DefaultInboundAction, DefaultOutboundAction

# On a future prepared guest, inspect only this approved root; never read key bytes.
$SandboxRoot = 'C:\HNC-Isolated'
if (Test-Path -LiteralPath $SandboxRoot) {
  Get-Item -LiteralPath $SandboxRoot | Select-Object FullName, Attributes
  Get-Acl -LiteralPath $SandboxRoot | Select-Object Owner, AccessToString
}
```

Stop if27018/5501 is occupied, binaries/signatures/hashes differ, there is an unexpected database service, or the guest has external networking. Do not kill the occupant or select another port. Absence of a default route alone is not proof (specific routes/tunnels/proxies can still exist); independently attest the disabled guest NIC/no host tunnels. Do not collect credentials in an inspection transcript.

Signature trust/revocation evidence may not be available offline; do not enable guest networking to satisfy a trust lookup. Obtain independently reviewed vendor/offline trust evidence before provisioning if status cannot be established.

## 4. P — dedicated directories, ACL and key preparation (NOT EXECUTED)

Only after approval INSIDE the dedicated guest, under its approved local operator identity. Refuse reuse, reparse points and network storage. Do not grant Everyone/Users access. Existing Windows administrators remain trusted; ACLs do not defend against a malicious administrator.

```powershell
$SandboxRoot = 'C:\HNC-Isolated'
if (Test-Path -LiteralPath $SandboxRoot) { throw 'Existing root: stop; never reuse a data directory' }
$parent = Get-Item -LiteralPath 'C:\'
if (($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Unapproved filesystem target' }
New-Item -ItemType Directory -Path $SandboxRoot -ErrorAction Stop | Out-Null
$RunSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$RootAce = $RunSid + ':(OI)(CI)F'
& icacls.exe $SandboxRoot /inheritance:r /grant:r $RootAce '*S-1-5-18:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'ACL operation failed' }
foreach ($name in @('data','logs','conf','secrets','tmp','receipts')) {
  New-Item -ItemType Directory -Path (Join-Path $SandboxRoot $name) -ErrorAction Stop | Out-Null
}

# Private development replica key: generate only after approval, never print/copy it.
$KeyPath = Join-Path $SandboxRoot 'secrets\replica.key'
if (Test-Path -LiteralPath $KeyPath) { throw 'Refuse to overwrite a key' }
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 756
try {
  $rng.GetBytes($bytes)
  [IO.File]::WriteAllText($KeyPath, [Convert]::ToBase64String($bytes), [Text.Encoding]::ASCII)
} finally { [Array]::Clear($bytes, 0, $bytes.Length); $rng.Dispose() }
$ReadAce = $RunSid + ':R'
& icacls.exe $KeyPath /inheritance:r /grant:r $ReadAce '*S-1-5-18:R' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Key ACL operation failed' }
# Inspect ACL only; do not Get-Content/Get-FileHash/export the private key.
Get-Acl -LiteralPath $KeyPath | Select-Object Owner, AccessToString
```

This is a replica membership secret, not the application DB password. It stays inside the guest, outside source/checkpoints/mapped folders. Authentication remains enabled at every startup; never use --noauth or transitionToAuth. The narrowly timed localhost bootstrap exception applies only before first-user creation, not as a runtime authentication shortcut. [MongoDB localhost exception](https://www.mongodb.com/docs/v8.0/core/localhost-exception/)

## 5. P — configuration rendering and startup (NOT EXECUTED)

Samples: server/tests/integration/provisioning/windows-sandbox.example.json and mongod.cfg.example. The JSON is an **equivalent sample provisioning specification**, not .env, not auto-loaded and not accepted directly by existing strict adapters. Fixed host/ports/DB/safety constants are requirements; executable paths, decisions, run identity and secret/provider values are placeholders only. Do not replace them in the repository with actual secrets. The mongod template intentionally has unresolved path/boolean placeholders and must fail until separately approved/rendered into the guest conf directory.

Approved rendered configuration must contain only these reviewed settings: guest dbPath/logPath/keyFile; bindIp127.0.0.1; port27018; ipv6:false; maxIncomingConnections16; authorization:enabled; replSetName:hnc_isolated; an explicit version-valid storage.wiredTiger.engineConfig.cacheSizeGB. This cache setting does not cap filesystem/connection/index/other memory; total RSS/job limits still need independent enforcement. For the pinned build, explicitly approve disableSplitHorizonIPCheck:true to retain the literal IP member, or stop and revise the target policy. Bootstrap uses enableLocalhostAuthBypass:true only for first setup; final config sets it false after verified user creation. Never set bindIpAll, a remote member, port27017 or a default dbPath. No actual config has been rendered by this task. Configuration fields/version support: [MongoDB configuration reference](https://www.mongodb.com/docs/v8.0/reference/configuration-options/).

```powershell
# File operations only until the explicit Start() line, which is a P action.
# Variables MongodExe/MongoshExe/NodeExe must already be pinned/verified in section3.
$SandboxRoot = 'C:\HNC-Isolated'
$ConfigPath = Join-Path $SandboxRoot 'conf\mongod.yml'
if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) { throw 'Approved rendered configuration missing' }
$publicConfig = [IO.File]::ReadAllText($ConfigPath)
if ($publicConfig.Contains('<') -or $publicConfig.Contains('>')) { throw 'Unresolved sample placeholders' }
foreach ($path in @($SandboxRoot, (Join-Path $SandboxRoot 'data'))) {
  if (((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse target denied' }
}
if (@(Get-ChildItem -LiteralPath (Join-Path $SandboxRoot 'data') -Force).Count -ne 0) { throw 'Initial data path is not empty' }
if (@(Get-NetTCPConnection -State Listen -LocalPort 27018 -ErrorAction SilentlyContinue).Count -ne 0) { throw 'Port already owned' }
$OwnerReceipt = Join-Path $SandboxRoot 'receipts\mongod-first-start.json'
if (Test-Path -LiteralPath $OwnerReceipt) { throw 'Existing launch receipt: separate restart procedure required' }
# Independently review every rendered field/hash/ACL; placeholder checks alone are NOT validation.
Get-FileHash -LiteralPath $ConfigPath -Algorithm SHA256

# STARTUP ACTION — separate explicit approval required; do not run now.
# Fresh child environment avoids production Mongo/env/proxy fallback; no .env loading.
$info = New-Object System.Diagnostics.ProcessStartInfo
$info.FileName = $MongodExe
$info.Arguments = '--config "' + $ConfigPath + '"'
$info.WorkingDirectory = $SandboxRoot
$info.UseShellExecute = $false
$info.CreateNoWindow = $true
$info.EnvironmentVariables.Clear()
$WindowsDir = [Environment]::GetFolderPath('Windows')
$info.EnvironmentVariables['SystemRoot'] = $WindowsDir
$info.EnvironmentVariables['PATH'] = (Split-Path $MongodExe) + ';' + (Join-Path $WindowsDir 'System32')
$info.EnvironmentVariables['TEMP'] = Join-Path $SandboxRoot 'tmp'
$info.EnvironmentVariables['TMP'] = Join-Path $SandboxRoot 'tmp'
$mongodProcess = New-Object System.Diagnostics.Process
$mongodProcess.StartInfo = $info
if (-not $mongodProcess.Start()) { throw 'Dedicated mongod did not launch' }
if ($mongodProcess.HasExited) { throw 'Startup failed; review sanitized local diagnostics' }
$receipt = [pscustomobject]@{
  pid = $mongodProcess.Id
  startedUtc = $mongodProcess.StartTime.ToUniversalTime().ToString('o')
  executable = $MongodExe
  configSha256 = (Get-FileHash -LiteralPath $ConfigPath -Algorithm SHA256).Hash
  dbPath = Join-Path $SandboxRoot 'data'
}
$receipt | ConvertTo-Json | Set-Content -LiteralPath $OwnerReceipt
```

No Windows service is installed/started. Do not use Start-Service MongoDB, net start MongoDB, generic node server.js, npm start or npm run dev. The temporary data-empty check is for **first creation only**; a reviewed same-instance restart uses its acknowledged ownership receipt, not an empty-directory workaround. Existing/default services and production environment files stay untouched. Guest egress must be disabled before launch; otherwise stop. Authentication exceptions/TLS policy must be recorded; accepting plaintext only inside an approved offline guest is not a production TLS recommendation.

### I — intended listener after a future authorized startup

```powershell
# Inspection only, not a connection. Require PID from the owned launch receipt.
$expected = Get-Content -LiteralPath $OwnerReceipt -Raw | ConvertFrom-Json
$ownedProcess = Get-Process -Id $expected.pid -ErrorAction Stop
if ($ownedProcess.Path -ne $expected.executable -or
    $ownedProcess.StartTime.ToUniversalTime().ToString('o') -ne $expected.startedUtc -or
    (Get-FileHash -LiteralPath $ConfigPath -Algorithm SHA256).Hash -ne $expected.configSha256) {
  throw 'Owned process/config receipt mismatch'
}
$listener = @(Get-NetTCPConnection -State Listen -LocalPort 27018 -ErrorAction Stop)
if ($listener.Count -ne 1 -or $listener[0].LocalAddress -ne '127.0.0.1' -or
    $listener[0].OwningProcess -ne $expected.pid) { throw 'Unexpected listener identity' }
$ownedProcess | Select-Object Id, StartTime, Path
```

## 6. C — replica/user/role provisioning (NOT EXECUTED)

This entire section connects or writes, including later status/permission queries. It is **not** inspection-only and requires target/command approval, the short localhost bootstrap window and operator admin-metadata exception. Run mongosh from its approved absolute path inside the same guest with --norc; never run bare mongosh (implicit default database/port is prohibited). Every URI names a database explicitly. Provisioner URIs include directConnection/timeouts for bootstrap; these are operator shell arguments, not accepted G1 harness config overrides. [mongosh options](https://www.mongodb.com/docs/mongodb-shell/reference/options/).

```powershell
# CONNECTED BOOTSTRAP ACTION. No password in URI/CLI; no inherited rc snippets.
$BootstrapUri = 'mongodb://127.0.0.1:27018/admin?directConnection=true&serverSelectionTimeoutMS=2000&connectTimeoutMS=2000&socketTimeoutMS=30000'
& $MongoshExe $BootstrapUri --norc
```

Only inside that explicit shell, for a verified brand-new dedicated instance:

```javascript
// C: first initiation only. Refuse reuse; do not reconfigure an existing set.
const requested = {_id: 'hnc_isolated', members: [{_id: 0, host: '127.0.0.1:27018'}]};
rs.initiate(requested);
// Wait boundedly for PRIMARY (operator deadline30s); do not loop indefinitely.
// MongoDB requires election before first-user creation. Inspect only approved metadata.
const h = db.hello();
if (!h.isWritablePrimary || h.setName !== 'hnc_isolated' ||
    JSON.stringify(h.hosts) !== '["127.0.0.1:27018"]') throw Error('Wrong/unready dedicated replica');
// Privileged HUMAN provisioner ONLY. Never give this user/password to the harness.
db.getSiblingDB('admin').createUser({
  user: 'hnc_provisioner', pwd: passwordPrompt(),
  roles: [{role: 'userAdminAnyDatabase', db: 'admin'}]
});
```

First-user creation ends the localhost exception. Do not create a role before that user, or assume exception access persists. userAdminAnyDatabase can effectively escalate privileges, so it is strictly an isolated operator bootstrap credential, not a least-privilege test identity. Exit and reconnect explicitly with a prompt (password flag last, no argument):

```powershell
# C: operator-only administrative authentication on NEW sandbox instance.
& $MongoshExe $BootstrapUri --norc --username hnc_provisioner --authenticationDatabase admin --password
```

Inside the authenticated operator shell, create the collection-scoped test roles/account. Replace only the run ID placeholder, never paste a password into code/history. Names below derive from current model declarations; verify the pinned compiled model-to-collection mapping before granting. Do not add guessed or wildcard namespaces.

```javascript
const sandboxName = 'hnc_step15q_sandbox';
const runId = '<UNIQUE_18_LOWERCASE_HEX_CHARACTERS>';
if (!/^[a-f0-9]{18}$/.test(runId)) throw Error('Unresolved run ID');
const s = db.getSiblingDB(sandboxName);
const collections = ['users','vendors','adminusers','gamesessions','campaigndefinitions',
  'wheelitems','spins','prizeawards','prize_decisions','prize_decision_recoveries'];
s.createRole({role: 'hnc_synthetic_fixture', roles: [], privileges: [
  ...collections.map(collection => ({resource: {db: sandboxName, collection}, actions: ['find','insert','update']})),
  {resource: {db: sandboxName, collection: 'admin_audit_logs'}, actions: ['find','insert']}
]});
s.createUser({user: 'synthetic_' + runId, pwd: passwordPrompt(),
  roles: [{role: 'hnc_synthetic_fixture', db: sandboxName}]});
// Separate, read-only metadata account; never inherit writer/admin roles.
s.createRole({role: 'hnc_schema_inspector', roles: [], privileges: [
  {resource: {db: sandboxName, collection: ''}, actions: ['listCollections']},
  ...[...collections, 'admin_audit_logs'].map(collection => ({
    resource: {db: sandboxName, collection}, actions: ['listIndexes']
  }))
]});
s.createUser({user: 'hnc_inspector_' + runId, pwd: passwordPrompt(),
  roles: [{role: 'hnc_schema_inspector', db: sandboxName}]});
```

No writer remove/drop/createIndex/grantRole/cluster/bypassDocumentValidation/readAnyDatabase/readWrite grant. audit has no update/remove permission. The metadata account has no document find/insert/update/remove privileges. Explicitly scoped insert can have implicit collection-creation implications; requiring existing approved collections before testing remains mandatory. These grants do not create valid fixtures, collections/indexes or the future connection/model facade. Required DDL must have its own named review/approval; no blind syncIndexes/TTL or generic dbAdmin grant. Privilege design: [MongoDB actions](https://www.mongodb.com/docs/manual/reference/privilege-actions/).

The existing adapter's synthetic-offline password prefix and flat role receipt are mock contracts, not a live password/privilege policy. Do not weaken passwords or broaden grants to make a mock contract accept this provisioned account. A separate reviewed private credential/attestation port is still required.

**Optional operator-only lifecycle role**, subject to its own approval, avoids handing the harness cluster administration. In the same authenticated provisioner shell:

```javascript
const a = db.getSiblingDB('admin');
a.createRole({role: 'hnc_local_lifecycle', roles: [], privileges: [
  {resource: {cluster: true}, actions: ['replSetGetConfig','replSetGetStatus','getCmdLineOpts','serverStatus','shutdown']}
]});
a.createUser({user: 'hnc_local_operator', pwd: passwordPrompt(),
  roles: [{role: 'hnc_local_lifecycle', db: 'admin'}]});
```

No role/user mutation should be rerun blindly after timeout; inspect the **specific** acknowledged user/role in the dedicated instance first. Never weaken authorization, assign root to fix an error or query/authenticate production test as a denial probe. Runtime secrets stay in a private prompt/memory provider, never repository JSON, logs, process arguments, checkpoints, host profile or production .env.

### C — replica/permissions verification (reads, but still CONNECTED)

Use the approved local lifecycle account on the explicit BootstrapUri for replica/process metadata, or provisioner for the exact new user grant query. These are separate credentials/permissions. Never print getCmdLineOpts or usersInfo wholesale.

```javascript
// Operator shell only: replica identity read, not a business-data query.
const rc = rs.conf();
if (rc._id !== 'hnc_isolated' || rc.members.length !== 1 || rc.members[0].host !== '127.0.0.1:27018')
  throw Error('Replica configuration mismatch');
// With lifecycle permission, project only the public settings to verify private root/binding/auth.
const options = db.getSiblingDB('admin').runCommand({getCmdLineOpts: 1});
if (options.ok !== 1 || options.parsed.net.bindIp !== '127.0.0.1' || options.parsed.net.port !== 27018 ||
    options.parsed.storage.dbPath !== 'C:\\HNC-Isolated\\data' || options.parsed.security.authorization !== 'enabled')
  throw Error('Instance configuration mismatch');
```

Provisioner-only specific-user verification (run ID must already be validated):

```javascript
const grants = db.getSiblingDB('hnc_step15q_sandbox').runCommand({
  usersInfo: {user: 'synthetic_' + runId, db: 'hnc_step15q_sandbox'},
  showPrivileges: true, showCredentials: false
});
if (grants.ok !== 1 || grants.users.length !== 1) throw Error('Expected one scoped user');
// Review inheritedRoles/inheritedPrivileges against the exact approved per-collection allowlist.
// Never output password hashes/custom user data, credentials or raw response bodies.
printjson({roles: grants.users[0].inheritedRoles, privileges: grants.users[0].inheritedPrivileges});
```

Use the same exact-user process for inspector/operator grants with their approved allowlists. This inspection **does not by itself enforce** future port query scopes. Do not try commands against test/admin data to prove denial. Independent role/OS/provisioning attestations, private receipts and version-pinned driver namespace controls remain required. [MongoDB usersInfo](https://www.mongodb.com/docs/manual/reference/command/usersinfo/).

After verifying users, quiesce and cleanly stop the owned process using section9, change only the **guest dedicated config** enableLocalhostAuthBypass to false, and perform a separately approved same-instance restart. authorization and keyFile remain enabled. Verify final settings and the same owned data path; do not replace/erase data, rotate keys or reuse a default installation config. If localhost bootstrap closure cannot be verified, runtime tests remain BLOCKED.

## 7. P — HTTP and egress preparation (NOT EXECUTED)

The future dedicated test listener must bind literal127.0.0.1:5501 inside the guest; no0.0.0.0, ::, hostname, port0, proxy or host port forward. The future listener owner must retain the exact server handle, enforce two in-flight requests/one request per second/2s request deadlines, and close only that handle. A future reviewed equivalent is server.listen({host:'127.0.0.1',port:5501,exclusive:true}); **this is a design contract, not an instruction to import/run the current server**. App→FraudDashboardPreview→four-session mock stays active; existing server.js, five mounts and deployment config remain unchanged.

The offline guard and current bootstrap's app.listen denial remain intact. No actual live runner/client exists. Real routes/models need a separately reviewed sandbox-bound loader and memory-only OTP/email/QR replacements before import. Do not grant SMTP credentials, load nodemailer live transports, make Axios/fetch/public API calls or issue/deliver prizes/QRs. Empty inherited child environment and explicit private providers are required; do not edit real environment variables. Existing sample flags do not activate live services.

Network-disabled guest is the primary external boundary; all processes use guest loopback, never host-forwarded services. Defense-in-depth Windows Firewall rules below are **P actions inside the guest only**, require elevation/scope approval, and are not a substitute for a working disabled NIC/runtime socket allowlist. Explicit block wins over conflicting allow; do not install Block-Any and expect a narrow Allow to override it. [Microsoft precedence](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules).

```powershell
# P: optional scoped guest rules only. Do not change host/global firewall profiles.
$RuleGroup = 'HNC-Isolated-<APPROVED_RUN_ID>'
if ($RuleGroup.Contains('<')) { throw 'Resolve the approved rule group first' }
if (@(Get-NetFirewallRule -DisplayGroup $RuleGroup -ErrorAction SilentlyContinue).Count -ne 0) { throw 'Rules already exist; review rather than overwrite' }
$OutsideApprovedIp = @('0.0.0.0-127.0.0.0','127.0.0.2-255.255.255.255','::/0')
$rules = @(
  @{Name='Node'; Program=$NodeExe; OtherPorts=@('1-5500','5502-27017','27019-65535')},
  @{Name='Mongo'; Program=$MongodExe; OtherPorts=@('1-27017','27019-65535')},
  @{Name='Shell'; Program=$MongoshExe; OtherPorts=@('1-27017','27019-65535')}
)
foreach ($rule in $rules) {
  if ($rule.Program.Contains('<') -or -not (Test-Path -LiteralPath $rule.Program -PathType Leaf)) { throw 'Unpinned rule executable' }
  New-NetFirewallRule -DisplayName ($RuleGroup+'-'+$rule.Name+'-ExternalTCP') -Group $RuleGroup -Profile Any -Direction Outbound -Action Block -Program $rule.Program -Protocol TCP -RemoteAddress $OutsideApprovedIp | Out-Null
  New-NetFirewallRule -DisplayName ($RuleGroup+'-'+$rule.Name+'-OtherLoopbackTCP') -Group $RuleGroup -Profile Any -Direction Outbound -Action Block -Program $rule.Program -Protocol TCP -RemoteAddress 127.0.0.1 -RemotePort $rule.OtherPorts | Out-Null
  New-NetFirewallRule -DisplayName ($RuleGroup+'-'+$rule.Name+'-UDP') -Group $RuleGroup -Profile Any -Direction Outbound -Action Block -Program $rule.Program -Protocol UDP | Out-Null
}
# I: effective rules/filters, not a network probe.
Get-NetFirewallRule -PolicyStore ActiveStore -DisplayGroup $RuleGroup |
  Select-Object DisplayName, Enabled, Direction, Action
Get-NetFirewallRule -PolicyStore ActiveStore -DisplayGroup $RuleGroup | Get-NetFirewallAddressFilter
Get-NetFirewallRule -PolicyStore ActiveStore -DisplayGroup $RuleGroup | Get-NetFirewallPortFilter
```

The ranges avoid a blanket-block/allow exception pattern. Do not assume native firewall treatment of every loopback/process path is a sufficient security boundary. Independently review effective policy/GPO and disabled guest networking; the future runtime must also deny any socket other than its exact allowlist (including port0/other local services), redirects, DNS, SMTP25/465/587, proxies, dynamic clients and child/worker bypass. Dedicated guest has no production27017 listener to begin with. Do not probe production endpoints to verify isolation. If rules/namespace/driver discovery cannot be attested, keep all live tests BLOCKED.

### Network-isolation checklist (all unverified until separately approved/performed)

- [ ] Fresh guest is not a host process namespace; NIC networking disabled/disconnected, no NAT/host forward/tunnel, no shared writable production directory/clipboard/profile.
- [ ] Only sanitized offline binaries/source/dependencies are present; signatures/hashes pinned; no install-created/default MongoDB service or other database listener.
- [ ] Intended Mongo27018 and future HTTP5501 are free before launch and owned exact loopback/PID after launch; nothing binds wildcard/IPv6/remote.
- [ ] Effective OS policy and runtime exact-socket allowlists exist before module imports; no production database reachable by topology discovery or inherited credential.
- [ ] Separate operator/writer/inspector identities and private key/password providers; writer has no admin/system/delete/grant/cluster scope; audit append-only.
- [ ] No live email/QR/API client; memory adapters installed before actual route/model loading; flagsallocation/campaignoff, experimentunregistered.
- [ ] Server16 cap and client pool5/maxConnecting1/owned sockets8 plus operator/internal overhead fit actual pinned build. Do not silently increase limits if refused.
- [ ] Actual native timeout/connection/CPU/RAM control, fixture ledger, index allowlist, error redaction and owned-handle shutdown approved. No automatic cleanup or silent retry.

## 8. Configuration ownership and approval record

Equivalent JSON sample remains executionAuthorized:false and autoStart:false. It has no production URI field, MONGO_URI mapping or auto-loader. Do not add a production fallback, feed it directly to the G1 adapter, or replace existing client/server .env files. A future reviewed renderer must reject unknown keys/unresolved placeholders, whitelist the exact tuple and require a trusted human approval event with code/version/config hashes. Real key/password values must never be saved in the sample. Operator bootstrap and inspector accounts must never be selected as runtime fallbacks.

Approval must identify guest/network policy, exact versions/signatures/hashes, sanitized staging allowlist, directories/ACL/operator, IP-member compatibility exception or target-policy revision, key/auth/localhost-bootstrap closure/TLS decision, explicit local admin/internal-metadata exceptions, collection-scoped roles, data/index provisioning scope, resource limits, retention/export and shutdown ownership. Actual connection/testing permission is separate from creating files/config/guest. No G2B stage becomes executable merely by approving this guide; live runner/driver/request/model bindings remain missing.

## 9. S — safe owned-instance shutdown and retention (NOT EXECUTED)

Stop new test work, await bounded in-flight requests/transactions and reconcile unknown commits. Close run-owned client/listener handles; never signal another process based only on a service name/port. Match the owned PID/start time/executable/config hash/dbPath first. Use the dedicated local operator account, not the test writer. The following connection requires its own approved local admin-metadata scope:

```powershell
# S/C: same explicit dedicated admin URI; prompt only, no credential argument value.
& $MongoshExe $BootstrapUri --norc --username hnc_local_operator --authenticationDatabase admin --password
```

Inside that operator session, after section6 replica/process identity checks and independently confirmed quiescence:

```javascript
// S: non-forced attempt. Requires approved shutdown privilege and owned-instance identity.
db.getSiblingDB('admin').shutdownServer({force: false, timeoutSecs: 10});
```

A single-member primary may refuse because step-down has no eligible secondary. **Do not automatically retry with force or kill it.** Stop and obtain the separately specified idle-single-member shutdown permission. Only after zero owned work/transactions/index builds and reconciled commits are attested:

```javascript
// S: separate explicitly approved idle-single-member action; NOT a general fallback.
db.getSiblingDB('admin').shutdownServer({force: true, timeoutSecs: 10});
```

Force can interrupt operations; a disconnected client is not sufficient proof of clean exit. Confirm the exact owned PID exited and27018 is no longer listening via I commands, then review sanitized clean-shutdown outcome; never delete lock/journal files or run repair to hide failure. Operator lifecycle quiescence deadline up to30s is a separate requested administrative exception, not a change to the2s test-operation budget. If shutdown/identity cannot be verified, retain/quarantine the guest and report BLOCKED. [MongoDB shutdown behavior](https://www.mongodb.com/docs/manual/reference/method/db.shutdownServer/).

No DB/collection/file deletion instructions are supplied. Retain synthetic state/audit/receipts; do not reset tokens, OTPs, attempts, inventories or redeemed records. Closing disposable Windows Sandbox destroys its contents and therefore needs its own retention/export approval after confirmed shutdown. Do not close it as an unreviewed cleanup/kill mechanism. Host data, firewall profiles, existing services and production secrets are never restored/modified by this procedure.

## 10. Deliverable status

PASS: prepared guide, inert JSON and mongod template; local syntax/template checks only. WARNING: IP-member version exception, operator metadata/bootstrap permissions, shutdown behavior, hardware/Windows availability and real network/resource/role enforcement remain unresolved. BLOCKED: all provisioning/installation/guest/service/connection/replica/user/firewall/integration execution until the scoped approvals above. No source-code change, no test rerun, no new live authorization. Baseline remains the last verified427 backend/354 frontend/129 assessment/185 syntax/build PASS, not a new verification claim.
