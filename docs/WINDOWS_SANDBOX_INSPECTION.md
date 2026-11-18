# Windows sandbox environment inspection — Phase G2C-2

Inspection date:29 October2026 (Asia/Qatar). Project: D:\spinning wheel comp.

**Conclusion: hardware and installed virtualization features appear suitable for a small isolated guest, but provisioning is BLOCKED pending the approvals/evidence below.** No MongoDB server was detected in the inspected installation locations. Only MongoDB Shell was found. The proposed ports were unoccupied at inspection time. Detailed firewall rules and actual guest isolation could not be verified.

This is an OS/filesystem metadata inspection, not a database, connection, guest-startup, authentication, integration, performance or security-enforcement test. No database contents/users/collections, credentials, private keys or .env contents were inspected. No software/service/guest/listener was started, stopped, installed or restarted; no firewall/system/application setting changed. Only this report was created.

## Prerequisite matrix

PASS = directly observed prerequisite, not execution authorization. WARNING = limitation/uncertainty. BLOCKED = required preparation or evidence unavailable; do not provision or connect on that basis.

| Prerequisite | Status | Observed finding / implication |
|---|---|---|
|Windows edition/architecture|PASS|Microsoft Windows10 Pro22H2,64-bit; version10.0.19045, update build revision6466 (19045.6466). Edition/build supports the relevant optional-feature family; actual guest operation was not tested|
|OS servicing/security acceptance|WARNING|Windows10 ordinary support ended14 October2025. ESU enrollment/current security compliance was not inspected or established. Owner must attest acceptable servicing or select an appropriately supported host before new provisioning. No upgrade/license/update action authorized|
|CPU capacity|PASS snapshot|Intel Core i7-7700 @3.60GHz,4 cores/8 logical processors. Sufficient nominal CPU count for the proposed small guest; no CPU-load, scheduling or capacity benchmark performed|
|Memory capacity|PASS snapshot|19.89GiB total,8.77GiB available at query time. A proposed4GiB guest leaves about4.77GiB of that observed free RAM for host/headroom, before other workload changes; not a reservation or proof of the512MiB per-process budgets|
|Disk and ACL-capable filesystem|PASS snapshot|C: NTFS,931.46GiB total/about570.13GiB available; D: NTFS,931.51GiB total/about222.58GiB available. Room for a small dedicated guest/staging area; no quota, storage latency, encryption, ACL policy or virtual-disk footprint validated|
|Windows Sandbox/Hyper-V feature state|PASS metadata|Containers-DisposableClientVM, Microsoft-Hyper-V-All and VirtualMachinePlatform each InstallState1 (enabled). WindowsSandbox.exe, vmcompute.exe and vmms.exe exist. vmcompute/vmms/HvHost/hns were already Running; inspection did not start them|
|Virtualization operational readiness|WARNING / launch verification BLOCKED|HypervisorPresent=true, but firmware virtualization, VM monitor extensions and SLAT WMI flags reportedfalse. Do not infer that firmware is disabled or that hardware is absent from these potentially masked/conflicting results under an active hypervisor. No guest launch/nested-virtualization/BIOS test performed; no BIOS or feature change recommended without operator review|
|MongoDB server executable|BLOCKED|Neither mongod.exe nor mongos.exe found on PATH or in the inspected common locations/installation metadata. This is not an exhaustive whole-disk search and cannot exclude an arbitrary portable/custom installation. No server version can be verified without an identified binary|
|MongoDB shell executable|PASS metadata / WARNING provenance|mongosh.exe found at C:\Users\IT\AppData\Local\Programs\mongosh\mongosh.exe. FileVersion/ProductVersion2.13.0; uninstall metadata also reports MongoDB Shell2.13.0. Binary not executed, connected, signature-verified or certified compatible with a future server build. It is a shell, not mongod|
|Existing MongoDB services/processes|PASS no observed collision|Zero matching Windows services and zero mongod.exe/mongos.exe/mongosh.exe processes. No existing Mongo service owner/config/command line was therefore available to report. Do not infer the absence of every stopped custom wrapper/container/remote instance|
|Proposed Mongo27018 / HTTP5501 ports|PASS snapshot|No TCP listener or UDP endpoint on either port. A later reservation/race, excluded range, ACL or firewall policy could still prevent binding. Reinspect immediately before any separately approved launch; no bind attempt was made|
|Reference Mongo27017 port|PASS snapshot|No TCP listener or UDP endpoint observed. No connection/probe was attempted and no default MongoDB instance was reused or stopped|
|Separate sandbox directories|PASS absent / creation BLOCKED|None of the proposed roots/data/log/conf/secrets/receipt/staging paths inspected exist. No directory was created. This avoids an observed existing-path collision; it does not provision or approve a path/ACL|
|Firewall enabled/profile defaults|WARNING|Domain/Private/Public profiles all Enabled=true, DefaultInboundAction=Block, DefaultOutboundAction=Allow. Default outboundAllow is not an isolated egress policy; specific block/allow/GPO rules may override defaults|
|Relevant firewall rule detail|BLOCKED|Get-NetFirewallRule ActiveStore and Get-NetFirewallPortFilter ActiveStore returned Access denied, including outside the workspace sandbox. Cannot establish HNC/Mongo/node rules, allowed ports/programs, conflicts or actual effective egress restrictions. No rule changed; an appropriately privileged operator must perform the remaining read-only review|
|Production independence / guest isolation|BLOCKED for execution|No observed local Mongo service or proposed-port collision, but no dedicated guest, disabled-NIC policy, scoped account, private data path or actual isolated database exists/was verified. Host loopback/unused ports cannot prove production test inaccessible|
|Live harness/credentials/replica readiness|BLOCKED|The existing plan still has liveExecutionAuthorized=false; tools/run-sandbox-integration.cjs does not exist. No Mongo installation, replica identity, account/grant, collection/index, driver/runtime port or real-model binding was provisioned/verified. Current adapters remain mock-only|

Windows lifecycle and virtualization interpretation references: [Microsoft Windows10 release/support information](https://learn.microsoft.com/en-us/windows/release-health/release-information), [Windows Sandbox prerequisites](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-install), [Win32_OptionalFeature state values](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-optionalfeature). Optional-feature presence is not proof that launching a guest will succeed. ESU/security acceptance remains an owner decision, not an inference from the build number.

## MongoDB discovery, service ownership and configuration scope

Inspected executable discovery: Get-Command for mongod.exe/mongos.exe/mongosh.exe; executable-file metadata in existing known product roots; MongoDB-named product entries in machine uninstall metadata. No binary was invoked, including --version. No registry license/product key or credential field queried.

The following server/product locations did not exist:

- C:\Program Files\MongoDB and C:\Program Files (x86)\MongoDB.
- C:\MongoDB / C:\mongodb and C:\tools\mongodb.
- C:\Users\IT\AppData\Local\Programs\MongoDB and C:\ProgramData\MongoDB.
- C:\HNC-Tools, D:\HNC-Tools and D:\MongoDB.

The existing per-user mongosh installation directory exists; no database/server configuration was inferred from it. It must not be copied with the user profile or shell startup scripts into a future guest. A sanitized offline bundle needs exact reviewed binary/dependency files and independent version/signature/hash review.

Windows service inventory selected service names/display names containing Mongo, or executable paths referencing mongod. Process inventory selected exact executable names mongod.exe/mongos.exe/mongosh.exe. Both returned zero matches. Therefore:

- No MongoDB Windows service name, service account/owner, startup mode, PID or service executable/config path was observed.
- No MongoDB process command line was available. No raw command line or inline URI/password was recorded. The inspection prepared an allowlisted path/binding-only sanitizer but had no matching Mongo command line to process.
- No service configuration, mongod.cfg/yml, database data/log contents, keyfile, .mongoshrc.js or actual .env was opened. Config path/ownership remains **not applicable for detected services / unknown for any undiscovered installation**, rather than guessed.
- Generic service wrappers, other user profiles, WSL/container volumes, custom nonstandard directories and remote deployments were not exhaustively searched. Do not reinterpret this report as proof that the whole machine/network has no MongoDB deployment.

Collision recommendation: do not install an auto-start host MongoDB service or use a generic MongoDB service name. Do not reuse27017 or adopt any subsequently discovered data/config directory. Use a new dedicated isolated guest with a separate binary/data/config identity. If an occupant appears later, stop for review; do not kill/restart it or silently select another port.

## Ports and firewall findings

Two read-only views were used: Get-NetTCPConnection for listening sockets, then .NET IPGlobalProperties TCP/UDP endpoint enumeration. Neither establishes a client connection or calls ping. Results agreed:

| Port | TCP listeners | UDP endpoints | Meaning |
|---|---:|---:|---|
|27017|0|0|No reference/default-port listener observed; not permission to connect|
|27018|0|0|Proposed host port appears available now; future guest must recheck its own namespace|
|5501|0|0|Proposed host port appears available now; no Express backend was started|

No socket owner/PID can be supplied for an absent listener. Active connections to unrelated remote services were not inspected or dumped. Reserved/excluded port ranges and actual binding permissions were not tested. Windows Sandbox guest127.0.0.1 is a different namespace; host occupancy observations cannot certify future guest ports.

Readable ActiveStore profile summaries showed all three profiles enabled, inboundBlock/outboundAllow. Detailed rule and port-filter enumeration remained denied. Consequently **no finding that relevant firewall rules are absent, adequate or unsafe is justified**. The access failure is an OS/policy visibility limitation, not an automatic approval-review rejection. Running outside workspace confinement did not grant administrator rights. No privilege/group/UAC/policy change or workaround was attempted.

Remaining read-only review by an authorized operator should include ActiveStore program/address/port filters and GPO precedence for Mongo/node/mongosh/HNC rules; whether guest networking really is disabled; and exact future socket allowlists. Do not change host-wide defaults or disable protection to obtain results. InboundBlock alone and a loopback bind do not deny external API/SMTP traffic.

## Proposed independent locations

Observed absent on the host: C:\HNC-Isolated, C:\HNC-Tools, C:\HNC-Source, D:\HNC-Isolated, D:\HNC-Sandbox-Staging and C:\HNC-Staging. C:\HNC-Isolated\data, logs, conf, secrets and receipts were also absent. No host/guest directory or ACL was created.

Retain the setup guide's separation, **inside the future guest**, not by reusing host files:

| Purpose | Proposed location | Status |
|---|---|---|
|Reviewed portable binaries|C:\HNC-Tools|Not staged/provisioned|
|Sanitized application copy|C:\HNC-Source|Not staged; never copy host .env/profile/backups wholesale|
|MongoDB data|C:\HNC-Isolated\data|Not created; new empty guest-only path required|
|MongoDB logs|C:\HNC-Isolated\logs\mongod.log|Not created; no existing log read|
|Dedicated public config|C:\HNC-Isolated\conf\mongod.yml|Not rendered; sample remains inert|
|Private membership key|C:\HNC-Isolated\secrets\replica.key|Not generated/read; separate approval and restricted ACL required|
|Owned run receipts|C:\HNC-Isolated\receipts|Not created; nonsecret PID/start/config/fixture ownership receipts only|
|Host staging, if approved|D:\HNC-Sandbox-Staging|Not created; exact sanitized allowlist/read-only guest mapping only|

No actual host dbPath or service config needs relocating based on observed results. NTFS supports the proposed ACL mechanism, but no future directory owner/ACL/reparse/path policy has been verified. Windows Sandbox content is disposable; evidence retention/export and eventual guest closure need an explicit lifecycle decision. A fresh dedicated offline VM is an alternative if persistence is required.

## Safest recommended provisioning approach

1. **Confirm OS security acceptance first:** supported/appropriately serviced isolation host or attested current ESU/security posture. Do not presume this CPU/system is eligible for a particular Windows upgrade; compatibility/licensing was not assessed.
2. **Prefer a fresh network-disabled Windows Sandbox**, because feature components are enabled and nominal resources are sufficient. Obtain approval for an actual guest launch/readiness check; the false virtualization WMI flags require interpretation under the active hypervisor, not blind BIOS changes. If Sandbox cannot run or its disposable lifecycle is unsuitable, review a dedicated offline VM instead. Do not fall back to a host Mongo service to bypass that gate.
3. **Prepare reviewed offline software inside that guest:** separately authorized version-pinned MongoDB server and shell/Node/dependency bundle, without installer-created default services. Host mongosh alone cannot establish a database. Copy only a reviewed sanitized allowlist; no host production environment, credentials, user-profile rc files or customer data.
4. **Provision only the agreed isolated tuple after approval:** guest127.0.0.1:27018, replica hnc_isolated, business database hnc_step15q_sandbox; future HTTP127.0.0.1:5501. New guest-only data/log/config/secret paths, authorization, private membership key and separate provisioner/writer/metadata-inspector accounts. Host services and production environment remain unchanged.
5. **Resolve the guide's remaining gates explicitly:** IP-only replica compatibility for the pinned MongoDB build, operator-only local admin/internal metadata bootstrap, closure of the localhost exception, TLS decision, actual collection-specific grants, cache/RSS/CPU/connection limits, firewall/guest isolation and owned single-member shutdown. No production test query, even as a negative permission test.
6. **Keep integration blocked until the reviewed live runtime exists:** real driver/model/router/credential/request bindings, seed acknowledgement ledger, named indexes and stage/budget permissions are still missing. Never weaken the existing offline guard or use server.js/.env startup as a replacement.

Resource judgement: one4GiB guest is plausible from the observed free RAM/CPU/disk snapshot, with host headroom. This is **not a load-test capacity claim**. The pinned MongoDB cache and job/RSS limits remain unmeasured; do not assume a4GiB guest enforces the earlier512MiB server/application limits. Concurrent host workload, VM storage growth and memory overhead must be reviewed before allocation. No RAM/CPU/disk benchmark or reservation performed.

## Exact actions requiring separate approval

- An appropriately privileged **read-only** effective firewall-rule/filter inspection; any extra virtualization/OS-servicing verification beyond this report.
- OS/feature/BIOS/nested-virtualization/licensing/ESU changes, reboot or administrator/group/UAC changes. None are implicitly authorized to fix the contradictory WMI flags or permission denial.
- Downloading, installing or staging binaries/dependencies; enabling or launching Windows Sandbox/VM; creating a staging area, mapped folders or guest virtual disks and changing network attachment.
- Creating guest data/log/config/receipt/private-key paths, applying ACLs, rendering configuration, generating secrets, defining accounts/roles or creating collections/indexes.
- Starting, stopping, restarting or installing any service/process/listener, including mongod and the future Express test listener. Shutdown force/quiescence/retention scope requires its own owned-instance approval.
- Any DB/shell/driver connection or status/role/schema/index query; replica initiation/reconfiguration; operator admin-metadata bootstrap; actual synthetic seeding/transactions/authentication/recovery/redemption-simulation/concurrency work.
- Any firewall/egress/proxy setting change, even if scoped to a guest. Current denied rule inspection is not permission to change policy.
- Cleanup/deletion/guest destruction or evidence export. No automatic reset, drop, broad deletion, token/OTP/attempt rollback, real QR/prize/customer participation, production access or deployment is approved.

Until those gates are satisfied, **this machine is a plausible candidate host, not an approved or verified live sandbox**. Preserve ALLOCATION_ENABLED=false, disabled customer campaign participation, the original four-session mock preview, unchanged API mounts and unregistered experimental fraud-report endpoint.

## Inspection method and limits

Initial workspace-confined CIM OS/resource queries returned Access denied. Their null/zero placeholders are **not measurements** and are not used in this report. With the approved outside-workspace read-only query, OS/resources/services/processes/listeners/profile summaries succeeded; detailed firewall rules/port filters still failed. The feature/install/service-running observations came from additional read-only CIM/registry/service/file metadata. No broad raw command-line or environment dump retained, and no executable was launched to determine its version.

No application/adapter/test source, existing .env, blocked execution plan or system configuration changed. Application tests/build were not rerun because this task is inspection/reporting only; the prior427 backend/354 frontend/129 assessment/185 syntax/build-PASS baseline is not a new verification result. Stop before provisioning, connections, installation or startup.
