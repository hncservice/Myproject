# Phase G2C-3 — isolated Windows guest provisioning plan

29 October2026 (Asia/Qatar). Project: D:\spinning wheel comp.

**Planning only. Every creation, configuration change, package import, installation, startup, connection, test and rollback command below is NOT YET AUTHORIZED. None was executed.** No guest is assumed to exist. This document does not authorize changes to the host, application, environment, existing database or G2B execution flags. Only this plan file is created.

## 1. Evidence and recommendation

Reviewed WINDOWS_SANDBOX_INSPECTION.md, WINDOWS_SANDBOX_SETUP.md, PHASE_G2B_FINAL_PREFLIGHT.md, PHASE_G2B_EXECUTION_PLAN.json and both inert samples in server/tests/integration/provisioning. Existing constraints remain: only guest127.0.0.1:27018 / replica hnc_isolated / business DB hnc_step15q_sandbox; eventual guest HTTP127.0.0.1:5501. Allocation/customer participation stay disabled and experimental reporting unregistered. The original four-session mock preview and five API mounts remain unchanged.

The previous inspection observed Windows10 Pro22H2 x64/19045.6466,4 cores/8 logical processors,19.89GiB RAM/about8.77GiB free, C: about570GiB and D: about222.58GiB free. Hyper-V/Sandbox features were enabled; relevant services already running. Firmware/SLAT flags conflicted with HypervisorPresent=true. No MongoDB server/service/process or27017/27018/5501 listener was found in the inspected scope; only mongosh2.13.0. Detailed firewall rule access was denied. These are historical observations, not current reservations or proof of guest operability. No OS/port/firewall query was rerun for this plan.

**Recommend a new dedicated Generation2 Hyper-V VM with ZERO virtual network adapters**, not merely a disconnected adapter or the Default Switch. Prefer read-only ISO import and basic console; prohibit shared host directories, clipboard/device redirection, guest file-copy integration and reused production virtual disks. For this persistent, repeatable transaction-testing workload this supersedes the earlier one-off Windows Sandbox preference only as a recommendation; it changes no prior authorization.

| Requirement | Windows Sandbox, networking disabled | Dedicated Hyper-V VM, adapters removed |
|---|---|---|
|External network isolation|Explicitly disable networking in .wsb; verify after launch|Remove the VM's own NICs while Off; verify zero NICs before each boot and no guest routes afterward|
|Offline MongoDB installation|Possible; lost when Sandbox closes|Controlled persistent install from pinned offline media; no host/default MongoDB service|
|Replica-set/transaction tests|Possible inside the guest; no approved runtime exists yet|Same database requirements, with an explicit isolated VM identity and persistent receipts|
|Repeatable fixtures|Recreate full environment each time|Clean cold OS baseline plus new run IDs/keys/seed ledgers; never rewind active business records to force a pass|
|Resource controls|Coarse guest memory configuration, less persistent lifecycle control|Static RAM, vCPU count/CPU limit and disk/checkpoint budget; native per-process controls still needed|
|Checkpoint/rollback|Disposable teardown; no equivalent user-managed persistent baseline workflow|One approved cold baseline, no RAM snapshot of running MongoDB; restore is a separate destructive-scope decision|
|Host separation|Use no writable mappings/clipboard; exporting evidence requires a decision|No shared folders/disks, no enhanced-session resources; read-only ISO ingress, separately approved metadata egress|
|Prerequisites|Supported/serviced host edition and successful guest launch not proven|Compatible/licensed supported guest OS, Hyper-V privileges/media/storage and successful boot not proven|

Hyper-V is not protection against a hostile host administrator: hypervisor administrators can access VM disks/state. Trusted host/administrative policy is a prerequisite. Do not treat removal of Ethernet alone as proof that VMBus/console integration channels are disabled. Reference: [Hyper-V integration services](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/manage/Manage-Hyper-V-integration-services), [enhanced-session redirection](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/enhanced-session-mode).

Windows Sandbox remains an alternative for a separately approved disposable smoke environment if persistent rollback is unnecessary. Do not automatically fall back to Sandbox or a host MongoDB service if Hyper-V prerequisites fail; revise the approval record first.

## 2. Prerequisites and proposed resource envelope

All are unresolved until reviewed/attested by the operator; no installer/ISO/license/guest was discovered or downloaded here.

1. Acceptable host security servicing/ESU posture or an approved supported replacement host; read-only effective firewall review by an appropriately privileged operator. Do not infer Windows10 servicing or Windows11 eligibility from edition/feature presence. The inspected i7-7700 does not establish Windows11 compatibility. Select a supported/licensed Windows guest that meets actual CPU/TPM/Secure Boot and MongoDB requirements; no unsupported OS-requirement bypass. If vTPM/key-protector creation is needed, separately approve those host changes; this plan does not generate those keys.
2. Hyper-V command/module/parameter availability and local administrative permission, exact VM identity, no existing VM/path collision and sufficient fresh free resources. Do not enable features, change BIOS/nested virtualization, reboot, create a switch or modify global Hyper-V settings to bypass a failed prerequisite.
3. Proposed VM: unique HNC-G2C3-<18hex-run-id>, Generation2, static4GiB RAM,2 vCPUs, maximum50% per virtual processor, automatic startNothing, automatic checkpointsOff, Secure BootOn. CPU cap is a scheduler setting, not proof of one physical core or native per-process isolation. Application/server budgets from G2B remain separate and require guest enforcement.
4. Proposed storage: new D:\HNC-Lab\<VM-name> with one dynamic64GiB VHDX and at mostONE retained cold checkpoint. Budget VM directory<=140GiB, approved OS/payload ISO media<=12GiB total, preserve>=40GiB host free after worst-case reserved growth: require>=192GiB available before commitment. Earlier D:222.58GiB is only a snapshot; recheck. No copying existing VHD/database backup, pass-through disk, shared VHD or host-drive redirection. If approved media exceed12GiB or disk requirements differ, stop for a revised budget.
5. Offline staging/media D:\HNC-ReviewedBundle\<run-id> and D:\HNC-Media\<run-id>, outside the active project and not yet created. Operator-only host NTFS access including the VM's required service identity; no broad Everyone grants. Check all ancestors for reparse/network paths. Guest paths C:\HNC-Source, C:\HNC-Offline, C:\HNC-Tools and C:\HNC-Isolated are new and unrelated to host paths of the same spelling.
6. Fixed guest business target/ports above; authorization enabled, private replica membership key, per-collection synthetic writer/audit/metadata roles. No production test database connection or negative probe, no inherited MONGO_URI, production .env, proxy or credentials.
7. A reviewed live runtime is still missing. Mock-only adapters/offline guard must remain unchanged. Provisioning permission does not authorize real model/controller/driver loading, HTTP listener startup, DB tests, seed writes, DDL, workers, fault injection or loads.

## 3. Offline packages and source integrity

The import is a **new curated file bundle**, not a repository copy, backup restore or clone. Do not copy D:\spinning wheel comp recursively. No Git/GitHub operation is used. An operator must approve every entry and its purpose before package preparation/import.

Required media/BOM:

- Clean supported/licensed Windows installation ISO, approved edition/build, security-update packages if needed and valid offline installation/account workflow. Do not enable internet/sign in to a production/domain/cloud account to complete setup. If the selected edition cannot be installed/licensed offline within scope, stop.
- Pinned vendor MongoDB Server Windows offline distribution; prefer a verified portable ZIP installation to avoid an MSI-created default service, Compass/downloaders or auto-start. If an MSI is mandatory, review that exact version's unattended/service options first; no guessed generic msiexec command. Separate pinned mongosh and Node offline distributions. Host mongosh being present is not a verified guest package.
- Exact compatible locked dependency files, including reviewed Express/Mongoose/MongoDB driver/JWT/validation/native bcrypt artifacts and required Windows runtime prerequisites. Include package/lock/BOM and per-file SHA256/native signatures; do not run npm install, postinstall, package-manager downloads or arbitrary setup scripts inside the networkless guest. MongoDB shell optional telemetry/update/version checks remain denied by topology/runtime controls.
- Minimal approved source/test/config-template documents needed by the future runner, explicit synthetic fixtures only. Include actual transitive service/model/router dependencies after review; do not assume the current mock adapter is a full live loader. Frontend source is optional reviewed material, not permission to mount AuthenticatedApp or change the active host preview.
- A separately reviewed ISO builder if needed on an approved packaging station. No builder/ADK is assumed installed; no installation/download is authorized by this document. Media production must use only the already sanitized allowlist directory.

Exclude before any copy: all actual .env variants, credential stores, passwords/tokens, private keys/certificates, customer/export/log data, database files/dumps/backups, local-backups/local-checkpoints/security checkpoints, existing VM images, .git directories/files/bare repositories/.gitmodules/.github metadata and nested repositories. Exclude inactive application backup copies unless an explicit nonsecret test dependency review proves necessity. Public inert samples can be separately approved, but no actual environment file is imported. Source directories named data may contain legitimate synthetic UI fixtures; approval is per file/content, not a blanket recursive directory rule.

Per-file SHA256 manifest schema: relative path, byte length, sha256 and approved purpose/category, plus source revision-independent hash/BOM identity. Require normalized relative paths only: no absolute/UNC/drive/colon/ADS/wildcard/.. paths, links, junctions, device paths or reparse ancestors. Exact file-set comparison must reject missing, extra, duplicate and case-colliding paths. Scan only the candidate allowlisted content for secrets/customer data using reviewed offline tooling/human review; filename checks alone cannot certify it. A hash does not prove a file is safe or authentic.

Pin the manifest digest AND final OS/payload ISO digests through the trusted approval record outside the media. Verify vendor authenticity/signatures independently; a manifest stored beside an altered package is insufficient. Keep binary/manifest digests public but no private credential/key hashes. Do not execute package scripts as part of verification.

Controlled ingress: attach only the reviewed immutable payload ISO as a virtual DVD, copy only approved manifest files inside the guest, verify exact file set/length/SHA256 after copy, and eject the media. No shared directory, SMB, clipboard, RDP drive, Copy-VMFile, PowerShell Direct, guest-service transfer, host profile or network download is part of this plan. If no reviewed ISO/import method exists, import is BLOCKED; do not enable networking as a workaround.

**Proposed read-only package checks — not performed here:**

```powershell
# Future operator/guest inspection only; placeholders must match trusted approval.
$PayloadIso = '<APPROVED_ABSOLUTE_PAYLOAD_ISO>'
$ExpectedIsoHash = '<APPROVED_64_HEX_SHA256>'
if ($PayloadIso.Contains('<') -or $ExpectedIsoHash -notmatch '^[a-fA-F0-9]{64}$') { throw 'Unresolved approved package identity' }
if ((Get-FileHash -LiteralPath $PayloadIso -Algorithm SHA256).Hash -ne $ExpectedIsoHash) { throw 'Payload ISO mismatch' }
# On the guest, read only the mounted manifest after its digest has been pinned independently.
$ManifestPath = '<APPROVED_GUEST_DVD_MANIFEST_PATH>'
$ExpectedManifestHash = '<APPROVED_64_HEX_SHA256>'
if ($ManifestPath.Contains('<') -or $ExpectedManifestHash -notmatch '^[a-fA-F0-9]{64}$') { throw 'Unresolved manifest identity' }
if ((Get-FileHash -LiteralPath $ManifestPath -Algorithm SHA256).Hash -ne $ExpectedManifestHash) { throw 'Manifest mismatch' }
```

These checks are necessary but do not implement the full allowlist/path/secret/file-set verifier. A reviewed file-by-file staging/import procedure must implement those checks before any copy; no missing staging script is represented as existing software.

## 4. Proposed creation and boot sequence — NOT AUTHORIZED

Order is deliberate: create **Off**, harden/remove adapters, inspect, then separately approve first boot. Do not run this entire section under a single vague permission. Do not change another VM, host NIC, switch, default service or global enhanced-session policy. Installed Windows10 Hyper-V cmdlet/parameter compatibility must be checked first against Get-Command/Get-Help; the commands below are a pinned review proposal, not proof they are available.

### A. New VM only, no boot or OS installation

```powershell
# CREATION/CHANGE: requires approval A1. All paths/names must be filled and reviewed.
$ErrorActionPreference = 'Stop'
$RunId = '<APPROVED_18_LOWERCASE_HEX_RUN_ID>'
if ($RunId -notmatch '^[a-f0-9]{18}$') { throw 'Unresolved run identity' }
$VMName = 'HNC-G2C3-' + $RunId
$VMRoot = Join-Path 'D:\HNC-Lab' $VMName
$DiskPath = Join-Path $VMRoot 'system.vhdx'
if (Get-VM -Name $VMName -ErrorAction SilentlyContinue) { throw 'VM already exists; do not adopt it' }
if (Test-Path -LiteralPath $VMRoot) { throw 'Storage path already exists; do not reuse it' }
# Before this line: approve existing parent path/ACL, no reparse ancestors and >=192GiB free.
$vm = New-VM -Name $VMName -Generation 2 -MemoryStartupBytes 4GB -NewVHDPath $DiskPath -NewVHDSizeBytes 64GB -Path $VMRoot
if ($vm.State.ToString() -ne 'Off') { throw 'Unexpected VM state; stop without altering other VMs' }
Set-VM -VM $vm -StaticMemory -MemoryStartupBytes 4GB -AutomaticStartAction Nothing -AutomaticStopAction ShutDown -AutomaticCheckpointsEnabled $false -CheckpointType ProductionOnly
Set-VMProcessor -VM $vm -Count 2 -Maximum 50
Set-VMFirmware -VM $vm -EnableSecureBoot On -SecureBootTemplate MicrosoftWindows
# Scope removal to only this newly created, identified VM, never ManagementOS.
Get-VMNetworkAdapter -VM $vm | Remove-VMNetworkAdapter -Confirm
if (@(Get-VMNetworkAdapter -VM $vm).Count -ne 0) { throw 'Network adapter removal not proven; do not boot' }
# Disable host/guest copy and key-value exchange. Fail closed for unexpected/localized names.
$integration = @(Get-VMIntegrationService -VM $vm)
foreach ($name in @('Guest Service Interface','Key-Value Pair Exchange')) {
  $match = @($integration | Where-Object Name -eq $name)
  if ($match.Count -ne 1) { throw 'Review actual integration-service identity before continuing' }
  $match[0] | Disable-VMIntegrationService
}
# Record VM.Id, exact path/disk/resource/media hashes in an operator receipt before another phase.
$vm | Select-Object Id, Name, State, Generation, Path
```

No switch name is supplied; even any initially disconnected default adapter must be removed before boot. If any intermediate command fails, leave this new VM Off/quarantined and request review; do not automatically start, delete or apply broader changes. The existence check is not protection from another operator's concurrent changes: bind later operations to the recorded VM GUID and recheck ownership/state/path. [New-VM](https://learn.microsoft.com/en-us/powershell/module/hyper-v/new-vm), [adapter removal](https://learn.microsoft.com/en-us/powershell/module/hyper-v/remove-vmnetworkadapter), [VM settings](https://learn.microsoft.com/en-us/powershell/module/hyper-v/set-vm).

Use basic VMConnect console only, with enhanced session/clipboard/drives/printers/USB/audio sharing off. Operator must verify per-connection settings. Do not disable enhanced mode globally for other VMs. Do not use Save/suspend as shutdown. Guest-service/KVP disabling does not disable every management channel: PowerShell Direct/guest management availability must be separately reviewed/disabled per guest where supported, with no production/admin credential delegated. Retained heartbeat, time and graceful shutdown integrations must be explicitly allowlisted and verified; no file-copy/drive-share channel is allowed.

### B. First boot and clean OS installation

```powershell
# MEDIA/STARTUP: requires A2, after A1 receipt and isolation evidence. No action now.
$VMId = [guid]'<APPROVED_CREATED_VM_GUID>'
$vm = Get-VM -Id $VMId -ErrorAction Stop
$WindowsIso = '<APPROVED_ABSOLUTE_WINDOWS_ISO>'
if ($WindowsIso.Contains('<') -or $vm.State.ToString() -ne 'Off') { throw 'Unresolved media or wrong VM state' }
if (@(Get-VMNetworkAdapter -VM $vm).Count -ne 0) { throw 'NIC present; boot denied' }
# Independently verify exact Windows ISO SHA256/signature/license and recorded VM path/GUID.
$dvd = Add-VMDvdDrive -VM $vm -Path $WindowsIso -Passthru
Set-VMFirmware -VM $vm -FirstBootDevice $dvd
# This line is a distinct guest-startup boundary, not authorized by creating a VM.
Start-VM -VM $vm
```

Install only the approved Windows edition with a new guest-local account; no Microsoft/domain/production login, inherited profile, online activation/update fetch, host-drive import or account/TPM/CPU requirement bypass. Any required offline activation/update/runtime prerequisite is part of the reviewed media/license scope. No MongoDB/package/test install occurs under OS-only permission. Confirm networking and sharing from both sides using section6 before package import.

Guest timezone/clock must be deliberate; retain approved time synchronization or an offline time policy for OTP/expiry tests. Never manipulate host production time. PowerShell Direct and guest copy services must not be opened temporarily for convenience.

### C. Clean cold baseline and read-only package import

After verified clean OS, security/channel settings and a guest-native graceful shutdown, require VM Off. Create one baseline BEFORE MongoDB installation, DB data, signing keys, OTPs, synthetic DB accounts or fixtures. OS local-account state remains private guest disk data; do not export the VM as a public/source artifact. No running-memory checkpoint.

```powershell
# CHECKPOINT CHANGE: A3, separate approval; no action now.
$vm = Get-VM -Id $VMId -ErrorAction Stop
if ($vm.State.ToString() -ne 'Off' -or @(Get-VMNetworkAdapter -VM $vm).Count -ne 0) { throw 'Cold isolated baseline required' }
if (@(Get-VMSnapshot -VM $vm).Count -ne 0) { throw 'Unexpected retained checkpoint; storage review required' }
Checkpoint-VM -VM $vm -SnapshotName 'OSClean-NoNetwork-NoMongoData'
# Require ProductionOnly behavior supported by this host. Failure means stop, no Standard fallback.

# IMPORT MEDIA CHANGE: A4; revalidate approved ISO hash before attachment.
$PayloadIso = '<APPROVED_ABSOLUTE_PAYLOAD_ISO>'
if ($PayloadIso.Contains('<')) { throw 'Unresolved reviewed media' }
Add-VMDvdDrive -VM $vm -Path $PayloadIso
# Boot again only under an explicit A4 boot permission and after zero-NIC/media/channel checks.
```

Current host support for the selected cold checkpoint behavior is untested; if refused, stop for a revised backup/isolation plan, not a silent switch to live standard checkpoints. Checkpoints are not a database backup/transaction rollback guarantee. [Microsoft checkpoint guidance](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/checkpoints).

Inside the subsequently approved booted guest, execute only the reviewed allowlist importer: verify pinned manifest, every file digest/length and exact permitted file set before AND after copy to fresh C:\HNC-Source/C:\HNC-Offline. Reject any existing conflicting file; do not overwrite credentials/source/config/data. Then detach/eject payload media by exact approved drive identity, not wildcard removal. Its approved source/ISO hashes and copy receipts go in sanitized evidence. No host directory becomes mounted/writable in the guest; virtual DVD is a read-only import surface, not general host filesystem access.

## 5. Proposed MongoDB provisioning stages — no action now

Use WINDOWS_SANDBOX_SETUP.md sections4–6/9 for the exact directory/ACL/private-key/clean-environment startup, replica/user/role and shutdown command proposals. Those commands are incorporated **only as proposals** and each approval boundary below still applies. Do not execute the examples during this phase.

| Stage | Proposed operation | Required result / boundary |
|---|---|---|
|P0 media verification|Offline vendor package/hash/signature/runtime/OS compatibility checks in guest|Server package is not the host's mongosh-only installation; no auto-download, installer telemetry bypass or unreviewed native/postinstall code|
|P1 offline install|Preferred verified Server ZIP into new C:\HNC-Tools\MongoDB, separate mongosh/Node bundles and required approved runtimes|No Windows service auto-install/start, Compass/network helper or27017 default instance. If a required MSI has no reviewed no-service feature selection, stop. Installation does not authorize launch|
|P2 directories/config|New C:\HNC-Isolated\data, logs, conf, secrets, receipts; restricted guest-local ACL; render only the inert public sample after approval|No existing data/log/config reuse. Key is generated privately inside guest only under A5, never copied to source/host payload. Select a version-valid cache size and enforce total resource budgets independently|
|P3 controlled launch|Exact owned executable/config SHA256/PID/start receipt; empty inherited child environment per prior guide|bindIp127.0.0.1, port27018, auth enabled, replSetName hnc_isolated, server cap16; no .env/MONGO_URI fallback or live driver/client implicit connect|
|P4 replica/bootstrap|Explicit guest-only shell target; initiate one member127.0.0.1:27018, wait boundedly for primary, create first privileged provisioner then separate runtime/metadata accounts|Separate A6 connection/replica/admin-metadata/grant permission. IP-only member exception or revised hostname-policy approval required; no automatic localhost substitution. Auth remains enabled; tightly scoped localhost bootstrap exception then disable it|
|P5 runtime separation|Business DB hnc_step15q_sandbox, writer find/insert/update only on approved exact collections, audit find/insert only, separate metadata inspector and human lifecycle operator|No runtime root/readWriteAnyDatabase/drop/remove/grant/cluster/production credentials. Actual role/peer/DB receipts must be checked, not merely mock strings. Operator bootstrap admin/internal local metadata is an explicit exception, never harness permission to other DB data|
|P5b optional named schema provisioning|Only under separate A6b approval, create the exact approved empty model collections/indexes from a reviewed DDL manifest|Selecting/authenticating to the DB name alone does not create business collections. No createDatabase shortcut, placeholder data or extra sentinel namespace. Exact commands/options/names must be reviewed before execution; absence of that manifest/approval keeps database/schema readiness BLOCKED|
|P6 ready-but-not-testing|Recheck owned loopback process, exact final auth/replica/grants/directory identity, no external routes, no unexpected service|Do not seed/create indexes/test transactions or open HTTP under setup-only permission. G2B live runner/request/model/credential facade is still missing, even if installation succeeds|

**Proposed offline ZIP installation command, A5 only, NOT AUTHORIZED:**

```powershell
# GUEST ONLY: package pin must come from trusted approval, not just adjacent manifest.
$ServerZip = '<VERIFIED_GUEST_MONGODB_SERVER_ZIP>'
$ExpectedServerZipSha256 = '<APPROVED_64_HEX_SHA256>'
$Destination = 'C:\HNC-Tools\MongoDB'
if ($ServerZip.Contains('<') -or $ExpectedServerZipSha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'Package not approved' }
if (Test-Path -LiteralPath $Destination) { throw 'Refuse existing installation path' }
if ((Get-FileHash -LiteralPath $ServerZip -Algorithm SHA256).Hash -ne $ExpectedServerZipSha256) { throw 'Server ZIP mismatch' }
# Before extraction: review archive entry paths for traversal/ADS/links and pin exact file allowlist.
Expand-Archive -LiteralPath $ServerZip -DestinationPath $Destination
# Verify every extracted file against the reviewed BOM; do NOT launch mongod here.
```

This is installation from reviewed offline distribution media, not permission to replace a host/default service. Expanded vendor directory layout must be resolved to an exact executable; no unreviewed PATH search/default execution. If licensed installer packaging is required instead, its exact silent/features/service flags remain BLOCKED pending version-specific review. No unknown software is assumed installed.

Intended eventual HTTP listener is inside the same guest at127.0.0.1:5501, never host forwarded, wildcard or localhost-mapped to another namespace. Opening it requires A7 and a reviewed runner; current app.listen denial remains unchanged. Preserve G2B pool5/maxConnecting1/owned TCP8, HTTP2 in flight/1 request per second and2s operation budgets; VM limits do not implement those application limits. No live SMTP/QR/prize/campaign activation. No operator command authenticates to or queries production test, even as a denial probe.

## 6. Isolation verification checklist and evidence

No check below was executed during this planning phase. Configuration-only evidence is insufficient; require host configuration inventory, guest observed inventory, media/hash ownership and process/connection records. A missing/denied/ambiguous check is BLOCKED, not PASS. Do not enable networking to finish verification.

| Area | Host/guest inspection after separate approval | Expected result / remaining behavior test |
|---|---|---|
|VM identity/network|Host Get-VM/Get-VMNetworkAdapter by approved GUID, enumerate all VM adapters/switch attachments and passthrough devices|Correct isolated VM; zero NICs/virtual functions/host forwards, not just a friendly name or disconnected label|
|Guest adapters/routes|Guest Get-NetAdapter and Get-NetRoute for IPv4/IPv6|No usable non-loopback NIC, default route or specific external/host route. Disabled hidden adapter must not be silently re-enabled|
|DNS/egress|Guest Get-DnsClientServerAddress, proxy configuration names/addresses only, no secret environment dump; verify disabled networking and effective socket policy|No external DNS/proxy route. No Resolve-DnsName/ping/curl/Test-NetConnection attempted now. If active negative-canary testing is later required, approve exact synthetic nonproduction targets, capture scope and stop rules separately; no probing host/production services|
|Guest-to-host TCP|Zero-vNIC topology plus guest route/interface inventory, no switch/NAT/passthrough/forward|Ordinary host TCP path unavailable by design; actual behavioral denial remains untested until separately authorized. Do not claim this denies all hypervisor management channels|
|Host resources/management|Host integration-service list; basic-console settings; guest drives/SMB mappings/session devices/PowerShell Direct policy|No host disks/shares/profile/clipboard/drive/device redirection/file-copy/KVP; only explicit DVD. No Invoke-Command/Copy-VMFile/host credentials to import packages|
|Media and source|Host/guest independent approved digests, exact file-set/length/hash receipts and forbidden-item review|Only pinned OS/payload media and approved synthetic source/dependencies; no actual .env/private keys/customer data/database backups/Git metadata or extra files|
|Mongo process|Guest process name/path/PID/start/config receipt and service inventory; redact arguments and never print secrets|Only dedicated guest27018 process; no host/default27017 instance or installer-created auto-start service. No Mongo binary execution under inspection-only permission|
|Port bindings|Guest socket tables plus exact owned PID; separately approved DB/listener stages only|Mongo127.0.0.1:27018 and optional HTTP127.0.0.1:5501; no wildcard/IPv6/other port. A socket-table read is not a connection; bind/handshake requires explicit permission|
|Credentials/privileges|Privileged operator's exact new user/role metadata on dedicated instance only under A6|DB/collection allowlists and no inherited admin/delete scope; auth/keyfile/localhost-exception closure attested. Mock receipts/prefixes do not prove real grants; never query test to prove denial|
|Resources/recovery|Host VM memory/CPU/disk/checkpoint counters; future guest process-native caps/timeout/handle receipts|Within approved envelope; source/setup/checkpoint state and shutdown reconciled; no repeated mutations after unknown commit|

**Proposed inspection commands, future approved contexts only; not run here:**

```powershell
# HOST: use recorded GUID, not a name pattern or ManagementOS adapter.
$vm = Get-VM -Id $VMId -ErrorAction Stop
$vm | Select-Object Id, Name, State, Generation, Path
Get-VMNetworkAdapter -VM $vm
Get-VMMemory -VM $vm
Get-VMProcessor -VM $vm
Get-VMIntegrationService -VM $vm | Select-Object Name, Enabled, PrimaryStatusDescription
Get-VMHardDiskDrive -VM $vm
Get-VMDvdDrive -VM $vm
Get-VMSnapshot -VM $vm

# GUEST basic console: local configuration/socket metadata only, no network attempt.
Get-NetAdapter -IncludeHidden | Select-Object Name, Status, InterfaceDescription
Get-NetRoute -AddressFamily IPv4 | Select-Object DestinationPrefix, NextHop, InterfaceIndex
Get-NetRoute -AddressFamily IPv6 | Select-Object DestinationPrefix, NextHop, InterfaceIndex
Get-DnsClientServerAddress | Select-Object InterfaceAlias, AddressFamily, ServerAddresses
Get-SmbMapping -ErrorAction SilentlyContinue | Select-Object LocalPath, RemotePath, Status
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object LocalPort -in @(27017,27018,5501) |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

Inspect effective guest/host scoped firewall rules without changing profiles; previous rule enumeration was denied, so privileged read-only review remains a gate. Do not dump environment variables, arbitrary service command lines, registry credentials, browser/proxy authentication or raw DB logs. Windows host administrators, firmware/hypervisor integrity and side channels are outside a promise of absolute isolation; treat them as trusted prerequisites and explicitly state untested behavior.

## 7. Controlled shutdown, checkpoints, rollback and teardown

Default: retain/quarantine on failure, do not auto-delete or auto-restore. Shut down the DB only under the owned process/target approval in WINDOWS_SANDBOX_SETUP.md: stop new work, await bounded in-flight operations, reconcile commit receipts, close owned requests/listener/connection/sessions, verify exact PID/start/config/member, then approved admin shutdown. A single-member primary may refuse non-force; any force action requires separate verified-idle permission. Never kill all mongod/node processes, delete lock/journal files or repair data to conceal a failure.

Use a native guest graceful OS shutdown only after data/handles/evidence are settled; check the exact VM reaches Off. Do not force Stop-VM/TurnOff, save RAM or close a console as a substitute for shutdown. If close/commit/OS state is uncertain, keep the isolated guest quarantined and report BLOCKED.

Checkpoint policy: one **cold pre-Mongo/pre-dataset baseline**; automatic checkpoints disabled; no running-memory or live-authentication checkpoint. ProductionOnly must be supported or stop for review. Do not call a checkpoint a full backup, presume database consistency or use it as an ordinary domain compensation. Its private OS account/disk state stays in the dedicated protected VM path, never a source/public package.

Restore only after a new explicit destructive-scope approval naming VM GUID, checkpoint identity, affected disk paths, prior-run retention/evidence owner and safe shutdown receipt. Do not restore on failure merely to rerun the same identity until a test passes. The restored VM starts a **new independent run**: new run ID, signing/DB/replica secrets as needed, new synthetic identity/seed ownership receipts, no reused old JWT/OTP/session/QR/recovery receipts. Do not revive consumed business state or silently erase an unresolved commit/audit/inventory failure. If retaining required state/evidence cannot be reconciled with a whole-guest reset, do not restore.

```powershell
# DESTRUCTIVE RESTORE: A8 only, never an automatic error handler; no action now.
$vm = Get-VM -Id $VMId -ErrorAction Stop
if ($vm.State.ToString() -ne 'Off' -or @(Get-VMNetworkAdapter -VM $vm).Count -ne 0) { throw 'Owned cold isolated VM required' }
$baseline = @(Get-VMSnapshot -VM $vm | Where-Object Name -eq 'OSClean-NoNetwork-NoMongoData')
if ($baseline.Count -ne 1) { throw 'Ambiguous approved baseline' }
# Verify snapshot ID/parent/VM identity against approved receipt; archive permitted evidence first.
Restore-VMSnapshot -VMSnapshot $baseline[0] -Confirm
# Remain Off; revalidate all isolation/resource/media settings before separately approved boot.
```

Evidence export is another host-boundary operation, not automatic: only reviewed sanitized metadata/hash/assertion receipts, no DB backup, private key/password, raw OTP/JWT/QR, guest profile or entire VHD. No writable host mapping/clipboard/guest integration may be enabled ad hoc. If no separately reviewed one-way export procedure exists, retain evidence inside the isolated guest and block restore/teardown rather than losing required receipts.

Final VM/disk/checkpoint deletion requires exact owned GUID/path/count and retention permission, not a wildcard/name prefix or recursive deletion of a computed path. No removal command is supplied here. Do not delete host staging/project data, unrelated VMs, existing databases or evidence. Network never needs to be re-enabled for cleanup.

## 8. Exact separate approvals required

All require trusted user authorization, reviewed hashes/commands/operator/evidence owner, and only the specified scope. A JSON flag or this plan alone is not approval.

| Gate | User must explicitly approve | Does NOT authorize |
|---|---|---|
|A0 prerequisite/package review|Supported host/guest/licensing/security posture, read-only privileged Hyper-V/firewall checks, exact OS/vendor/native artifacts/manifest/ISO hashes, packaging station/tool and sanitized file allowlist|Downloads/installation, VM creation, source changes, credentials or networking changes unless separately named|
|A1 create/harden Off VM|Unique name/run ID/GUID receipt, new D:\HNC-Lab path,64GiB disk/one-checkpoint budget,4GiB/2vCPU/50% cap, zero-vNIC removal and per-VM integration restrictions, Secure Boot policy|Boot, OS/software install, network/switch/global host changes or vTPM key creation unless explicitly added|
|A2 first boot/OS install|Exact VM GUID and OS ISO, local account/license workflow, basic console/no redirection, offline guest setup and inspection deadline|MongoDB install/start, payload import, DB connection or host credentials|
|A3 cold baseline|Verified Off/pre-Mongo/no-data checkpoint, exact snapshot identity/storage/retention policy|Automatic restore, live checkpoint or test-state rollback|
|A4 media import and reboot|Exact read-only payload ISO/manifest/file set, verification/import destinations and boot permission, no shared paths or extra channels|Unreviewed executable execution/package scripts, Mongo launch, internet or evidence export|
|A5 offline Mongo installation/files|Exact guest software/runtime install commands and package hashes, data/log/ACL/public config/key-generation scope, resource/cache decisions|Starting mongod, connecting, initiating replica, granting roles or altering host services|
|A6 owned database setup/verification|Exact executable/config/target/budgets, launch/clean restart/shutdown receipt, IP-member exception or reviewed target-policy revision, private local key/credentials, bounded localhost bootstrap, explicit operator admin/internal metadata, exact replica/user/collection role commands|Production test, real/customer data, actual integration/seed/index/migration/worker/QR/prize action, live SMTP, API or HTTP listener|
|A6b optional named DDL|Separately reviewed exact model collection/index command manifest with names/options and operator-only least privilege, target identity, expected result and rollback policy|Blind schema enumeration, syncIndexes/TTL, index/collection drops, implicit fixture writes, migration or broad runtime DDL grants|
|A7 controlled integration|Separately implemented/reviewed live runner/driver/model/request/credential ports, stage-specific G2B command/source/target/seed/index/fault/rate/time/cleanup scope|Broad future stages, automatic concurrency ramp, authenticated UI/live dashboard activation, allocation, production or deployment|
|A8 shutdown/export/restore/teardown|Exact owned instance/GUID/checkpoint/files, quiescence/commit outcome, sanitized export channel/receipts, reset/new-run policy and destructive scope if requested|Unrelated services/VMs/files, force without idle proof, broad cleanup or business-state resurrection|

Current status: **plan prepared; all execution gates BLOCKED/unapproved.** No guest/package/OS/MongoDB was created, installed, started, connected or tested. No network connection attempt, secret generation, firewall change, Git operation, production/environment/application modification or source/test change occurred. Prior427 backend/354 frontend/129 assessment/185 syntax/build-PASS baseline is carried forward, not rerun. Static parsing of this document's PowerShell examples is permitted as validation only; it never executes their commands. Stop after this plan.
