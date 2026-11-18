# Phase G2C-4A — Hyper-V provisioning prerequisites

29 October2026 (Asia/Qatar). Project: D:\spinning wheel comp.

**Result: BLOCKED for VM creation.** Read-only checks resolve the previous permission uncertainty: the current execution token has neither effective Administrator nor Hyper-V Administrators membership, and Get-VM fails with an authorization error. No authorized installation media is available in the reviewed locations. Guest licensing/OS compatibility and host servicing acceptance still require the computer owner's decisions.

Reviewed PHASE_G2C3_GUEST_PROVISIONING_PLAN.md and PHASE_G2C4_VM_PROVISIONING_REPORT.md. This step does not create/start a VM, install/download software, change permissions or make a database/network connection attempt. Only this report is created.

## 1. Verified host and access findings

| Check | Status | Observed result |
|---|---|---|
|Host Windows|PASS identification|Windows10 Pro, EditionID Professional,22H2, x64, build19045.6466|
|Hyper-V installation|PASS metadata|Microsoft-Hyper-V-All, Containers-DisposableClientVM and VirtualMachinePlatform InstallState1 (enabled); Hyper-V cmdlets resolve to installed module2.0.0.0|
|Hypervisor/hardware readiness|WARNING|HypervisorPresent=true; Intel Core i7-7700 @3.60GHz,4 cores/8 logical processors. Firmware virtualization and SLAT WMI flags reportfalse. Active-hypervisor/extension observations do not establish that a new guest can boot or justify BIOS changes; no guest test performed|
|Effective Administrator role|BLOCKED|False in current token, both inside and outside workspace confinement|
|Effective Hyper-V Administrators role|BLOCKED|False; built-in group SID S-1-5-32-578 absent from current token. Administrator SID S-1-5-32-544 also absent. No full identity/group dump retained|
|Actual read-only Hyper-V access|BLOCKED, verified|Get-VM returned VirtualizationException. Outside workspace confinement it explicitly reported insufficient permission and directed contact with the authorization-policy administrator. No VM count/configuration could be obtained|
|CPU resources|PASS snapshot|4 physical cores/8 logical processors supports the nominal2-vCPU request; actual utilization/performance not tested|
|RAM resources|PASS snapshot|19.89GiB total/about8.62GiB free. Planned4GiB guest would leave about4.62GiB of that observed free RAM before overhead/workload changes; not a reservation or capacity guarantee|
|Disk resources|PASS snapshot|NTFS C: about569.15GiB available; NTFS D: about222.55GiB available. D: exceeds the planned192GiB prerequisite by about30.55GiB; no disk allocation/reservation performed|
|Approved media/staging paths|BLOCKED absent|D:\HNC-Media, D:\HNC-ReviewedBundle and D:\HNC-Sandbox-Staging do not exist; no ISO/manifest can be verified there|
|Dedicated VM/data roots|NOT CREATED|D:\HNC-Lab and C:\HNC-Isolated absent. No directories created or existing VM adopted|
|Guest/ISO/license selection|BLOCKED owner decision|No exact guest Windows edition/build, licensed offline installation workflow, approved absolute ISO path or independent expected SHA256 supplied/identified|
|Host security servicing|BLOCKED acceptance decision|Host is Windows10 Pro22H2; ESU enrollment/current servicing compliance was not queried or attested. Build identification alone cannot establish current security support|

The initial confined Get-VM failure was repeated outside workspace confinement, using the existing account/token, to distinguish filesystem/tool confinement from Windows authorization. That read-only repeat did **not** use UAC elevation, switch account, grant membership, change ACLs or bypass authorization. The OS still denied Hyper-V management access. It is not an automatic approval-review rejection.

Current privileges cannot create/configure/inspect the proposed VM through the tested management path. Cmdlet presence is not permission. These findings concern this execution token/session, not whether the human owner has a separate authorized administrator account.

## 2. Media discovery scope and result

The only approved media search locations in the reviewed plan are the named HNC media/curated bundle/staging roots above; they are all absent. No authorized Windows installation ISO was found or hashed. Project documentation filenames were also checked for explicit approval/media/license records; no such media selection was identified. The old G2B live execution plan remains executionReady:false/liveExecutionAuthorized:false and is not a source of installation entitlement or credentials.

No Downloads, personal account directory, other drive subtree, network share, USB content, existing VHD or unknown ISO was searched/adopted. This is **not** a claim that the entire computer contains no Windows media. If the owner has a suitable local ISO elsewhere, the owner must identify that exact absolute path and authorize read-only inspection there; this task does not silently broaden the search or copy it.

An authorized media record needs: exact Windows product/edition/build/architecture/language, absolute local ISO path, byte length, independently approved SHA256 and trusted origin/authenticity evidence, applicable license/activation rights and an approved network-disabled setup workflow. Hashing an arbitrary file and accepting its self-generated digest is not sufficient provenance. Do not paste product keys/passwords, inspect private credential stores, use another machine's installed Windows image or copy a production database/VM backup.

## 3. Required licensing, servicing and compatibility decisions

These are decisions for the computer owner/licensing or system administrator, not inferred entitlements. No product key, activation store, license credential or account subscription was read.

1. **Host servicing:** confirm that this Windows10 Pro host has an acceptable current servicing/ESU posture, or select an approved supported replacement host. Ordinary Windows10 support ended14 October2025; no ESU coverage is assumed from the build number. Do not automatically enroll, purchase, upgrade, update or reboot. [Microsoft release information](https://learn.microsoft.com/en-us/windows/release-health/release-information), [ESU information](https://www.microsoft.com/en-us/windows/extended-security-updates).
2. **Guest edition/license:** confirm the right to run the chosen Windows edition as a separate VM, the intended duration/use and offline activation/update workflow. A host Pro edition, an installed shell or possession of an ISO is not a license-verification result. Applicable rights depend on the actual agreement/program; the licensing administrator must confirm rather than infer blanket virtualization rights. [Microsoft virtualization licensing guidance](https://www.microsoft.com/licensing/guidance/Windows-11-Licensing-for-Virtual-Desktops).
3. **Guest compatibility:** do not automatically choose Windows11. Microsoft specifies Generation2, Secure Boot/vTPM, memory/storage/vCPU requirements and a host-processor requirement for Windows11 VMs. The observed i7-7700 is not an established supported choice under the published Intel processor families; IT must validate the exact supported configuration or choose another compatible licensed guest/host. No CPU/TPM/Secure Boot/account setup bypass is allowed. [Windows11 VM requirements](https://learn.microsoft.com/en-us/windows/whats-new/windows-11-requirements#virtual-machine-support), [supported Intel processors](https://learn.microsoft.com/en-us/windows-hardware/design/minimum/supported/windows-11-supported-intel-processors).
4. **Offline guest setup:** select an official, permitted network-disabled installation/local-account workflow. If that edition/license requires online setup or activation beyond the approved offline method, stop and revise the selection; do not connect the guest, inject production/cloud credentials or use registry/account-requirement bypasses. Windows10 guest use would need its own applicable servicing/license decision; host acceptance does not automatically attest the guest.
5. **Guest security:** record whether the chosen OS needs vTPM/new key-protector creation and any approved local administrator setup. Those changes need a separate exact scope; this step did not generate keys or create accounts. The future guest must also be compatible with the separately selected MongoDB Windows build before database installation is proposed.

No specific guest SKU, support exception, purchase, installation media or alternative host has been selected for the owner by this task. If no compatible/licensed/offline-serviced guest can be approved on this hardware, provisioning must remain blocked or move to an explicitly approved host; no silent technology/OS fallback.

## 4. Confirmed proposed resource and media envelope

The existing reviewed plan remains the authority; no cap was raised or resource allocated.

| Item | Proposed limit | Current evidence / owner confirmation |
|---|---|---|
|VM|New Generation2 HNC-G2C3-<unique18hex-run-id>|No name/GUID allocated; owner confirms exact isolated identity/path before A1|
|Networking|Zero adapters; no switch, NAT, host sharing, pass-through or port forward|Creation/hardening still blocked; no guest exists to certify|
|CPU|2 vCPUs,50% max per virtual processor|Nominal host core count sufficient; scheduler cap is not proof of a physical-core or per-process budget|
|Memory|Static4GiB|8.62GiB free snapshot; refresh immediately before reservation/creation|
|VM disk|New dynamic64GiB system.vhdx|Never an existing/production VHD; dynamic maximum is not zero required capacity|
|VM storage|<=140GiB including at mostONE retained cold checkpoint|Host path D:\HNC-Lab\<VM-name>; no allocation yet. Checkpoint/rollback not automatically authorized|
|ISO/media|<=12GiB total approved OS+payload media|No media supplied; require actual lengths/digests and exact build/license selection. Larger media requires revised budget before use|
|Disk prerequisite|>=192GiB available, preserving>=40GiB after reserved VM/media growth|D:222.55GiB passes snapshot; fresh check plus path/ACL/reparse validation still required|
|Runtime limits|Earlier Mongo/HTTP pool, socket, timeout, CPU/RSS limits remain separate|Hyper-V allocation does not implement native process caps. No Mongo/HTTP resource test or install authorized|
|Integrity|Independent ISO SHA256 and per-file curated payload manifest|Neither a trusted media record nor actual ISO was available to verify|

## 5. Safe owner steps to resolve the blockers

These instructions are for completing the decision/inspection prerequisites. They do **not** tell the current agent to change permissions, elevate, download, install or provision.

1. **Choose the responsible operator.** Have the computer owner/IT administrator use an already authorized local Hyper-V management account/session. Prefer that to granting broad rights to the agent. If the owner uses ordinary Windows UAC consent to open their own authorized administrator session, it is their separate action; this task does not trigger elevation or request their password. Any account/group/UAC/policy change requires a separate owner/IT-controlled process and is not included here.
2. **Verify access read-only in that authorized session.** Check effective roles and Get-VM without invoking any New/Set/Start/Stop/Remove command. Report only success/count or the permission error, not unrelated VM details. A successful read is necessary but not proof that every mutation is authorized; creation still requires its own scope. If access remains denied, contact the system authorization-policy administrator; do not disable UAC, policies, firewall or Hyper-V protection.
3. **Decide host and guest security/licensing.** Record approved host servicing status and guest edition/build/rights/offline setup/CPU/TPM decision without keys or credentials. Consult the referenced Microsoft requirements and the applicable license terms. Do not assume Windows11 eligibility or that host entitlement covers the selected guest.
4. **Identify existing official media.** If the owner already has an approved local ISO, supply its exact path and trusted expected SHA256/size/origin. If it is outside the named roots, authorize that file's read-only metadata/hash check explicitly. If no suitable media exists, obtaining it is a separate owner-approved download/staging task; do not fetch it automatically or copy personal/production directories.
5. **Verify that specific media read-only.** Compare local byte length/SHA256 with the independent approval record. Do not mount, boot, extract, copy, install or run it during verification. A mismatch/unavailable file blocks further work. An authentic ISO still does not establish guest licensing or OS compatibility.
6. **Reconfirm capacity and exact scope.** Refresh free RAM/disk, name/path collision, approved parent ACL/reparse state and host management capability. Name the run ID/path and retain4GiB/2-vCPU/50%/64GiB/140GiB/12GiB budgets. No wildcard VM adoption or host service change. Any changed cap/OS/vTPM requirement needs review first.
7. **Issue a concrete next-stage authorization only after the evidence is complete.** Specify A1 create/harden Off VM only; A2 media attachment/first boot/OS install if separately intended; A3 cold baseline only after installation/shutdown. Include operator, exact paths/hashes/OS decision/budgets and zero-NIC/basic-console restrictions. No MongoDB, source import, replica/user/secret provisioning, database/HTTP connection, listener or integration test follows from this prerequisite report.

### Optional read-only commands for the owner/operator

These examples were not executed as a change or in a privileged replacement account by this task. Earlier equivalent read-only queries in the current execution token produced the findings above. Do not add mutation/elevation commands to make a check succeed.

```powershell
# Role/access inspection only, in the operator's existing authorized session.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal $identity
$HyperVSid = New-Object Security.Principal.SecurityIdentifier 'S-1-5-32-578'
[pscustomobject]@{
  AdministratorEffective = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  HyperVAdministratorsEffective = $principal.IsInRole($HyperVSid)
}
try {
  $count = @(Get-VM -ErrorAction Stop).Count
  'Read-only Hyper-V access succeeded; VM count=' + $count
} catch { 'Read-only Hyper-V access denied/unavailable; consult the authorized operator' }

# One explicitly owner-approved media file only; no scanning/mount/install.
$IsoPath = '<APPROVED_EXISTING_ABSOLUTE_ISO_PATH>'
$ExpectedSha256 = '<INDEPENDENTLY_APPROVED_64_HEX_SHA256>'
$ExpectedBytes = '<APPROVED_BYTE_LENGTH>'
if ($IsoPath.Contains('<') -or $ExpectedSha256 -notmatch '^[a-fA-F0-9]{64}$' -or
    $ExpectedBytes -notmatch '^[1-9][0-9]*$') { throw 'Resolve the trusted approval record first' }
$file = Get-Item -LiteralPath $IsoPath -ErrorAction Stop
if ($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Not an approved ordinary ISO file' }
# Independently approve canonical path/ancestors and .iso extension before this read.
if ($file.Length -ne [int64]$ExpectedBytes) { throw 'ISO byte length mismatch' }
$digest = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
if ($digest -ne $ExpectedSha256) { throw 'ISO digest mismatch' }
'Approved file digest/length matched; no installation or connection occurred'
```

The owner-provided media record should contain only nonsecret path/product/build/size/digest/source/license-decision references. Do not write product keys, administrator passwords, subscription tokens, actual .env values or production data into a report, manifest or chat.

## 6. Remaining blockers and stop record

- **BLOCKED — current account access:** effective admin and Hyper-V-admin checks false; actual read-only management operation denied outside workspace confinement. Owner/IT must provide an appropriate authorized operator/session; no rights were changed.
- **BLOCKED — verified local media:** all reviewed media/staging paths absent; no approved ISO/expected digest/size/edition/licensing record available. No download, scan of personal locations or unverified substitution.
- **BLOCKED — host/guest decision:** host servicing/ESU, guest entitlement, compatibility/offline setup and any TPM/key requirement unresolved. No activation/licensing/firmware secrets were read or bypassed.
- **PENDING — fresh reservation/owner scope:** resources nominally sufficient, but not reserved; final identity/path/ACL/ISO/budget and A1/A2/A3 evidence/authorization record still required before mutation. Guest isolation/firewall attestations remain prerequisites; this report makes no new effective-rule claim.

The earlier G2C4 report's unverified delegated privilege is now resolved **for this current execution token** as failed effective-role/read-access checks. Nothing else has been provisioned or enabled. No Get-VM failure was used as permission to try a mutation. Only this report was created; no existing source/adapter/test/plan/environment file, host permission/service/firewall, VM or storage configuration changed. No installation, VM/HTTP/database startup, DB connection, SMTP/QR/prize/campaign activation, production access or Git/GitHub operation occurred. Application regressions/build were not rerun for a read-only prerequisite report. **Stop here; all creation/provisioning remains blocked.**
