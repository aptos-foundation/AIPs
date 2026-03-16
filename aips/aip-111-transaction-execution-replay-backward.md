---
aip: 111
title: Transaction Execution Replay Backward Compatibility Policy
author: sherry-x
discussions-to: 
Status: Draft
last-call-end-date (*optional):
type: Standard (Core)
created: 12/04/2024
---

# AIP-111 - Transaction Execution Replay Backward Compatibility Policy

## Summary

This AIP proposes a backward compatibility policy on the Aptos network, limiting transaction replay-ability to 6 months using production node binary. Transactions older than this period will not have guaranteed compatibility and same execution output on Aptos validator or fullnode, allowing Aptos to prioritize resources for performance, security, and scalability improvements. However, validators and fullnodes can still use output sync mechanism to verify all transactions from genesis and rebuild history.

## Motivation

Currently, Aptos maintains long-term compatibility for transaction replay on the production node binary, leading to increased technical debt, resource allocation challenges, and potential security risks. By introducing a 6 months replay-ability limit, Aptos can optimize its infrastructure for better performance and maintainability. This change aligns with goals to streamline code, improve security, and allow for a more flexible architecture.

### Goals

- Define a backward compatibility policy for aptos-core blockchain and framework code with a 6 months replay-ability limit.
- Reduce technical debt, allowing aptos-core contributors to cleanup legacy code, and simplify the Aptos Framework.
- Continue supporting output sync, backup, and restore services, which can verify the full history of the Aptos network.
- Establish clear expectations for developers on transaction compatibility.

### Out of scope

- Compatibility policies for APIs, SDKs, CLI, or other tools.
- Software upgrade requirements for Aptos nodes.

## Specification

- **Replay-Ability Expiration Policy**
    - The `aptos-core` repository will maintain code to ensure transactions are replayable (producing the same output) for at least 6 months from their execution date using the latest production node binary. Beyond this period, replay compatibility is not guaranteed, as legacy code may be removed. Transactions older than 6 months may still execute but could produce different outputs with latest version of binary.
    - This policy applies only to deprecated or unused code. For instance, when deprecating feature X, updates will be made to the code, API, and documentation to inform users, and aptos-core will maintain compatibility for at least 6 months before code removal.
- **Testing and validation**
    - A transaction replay tool will enforce this policy.
    - A replay test will run on the main branch of aptos-core every two days.
    - All code released to mainnet must pass the transaction replay test.
    - The transaction replay tool will be enhanced to support a selectable time range for replay testing, with a 8 months data window to allow a margin for error.
- **Documentation**
    - Aptos developer documentation and guides will be updated to reflect the 6 months replayability limit, including clear guidance on handling transaction histories, state-sync, and other node operation impact.
    - A detailed change log will be created for each release to highlight replay-breaking changes, specifying the binary release version in which these changes occur and providing instructions for handling compatibility adjustments.
- Genesis replay-ability support
    - Although this proposal removes the ability to replay transactions from genesis on the latest production node binary, replay-ability will still be supported through:
        - **Output Sync Mode**: Nodes can apply transaction outputs from genesis, skipping transaction re-execution and instead applying the outputs from prior validator execution, thus preserving cryptographic guarantees and minimizing CPU time.
        - **Backup and Restore Services**: Backup services will provide all metadata needed to rebuild full history and replay transaction ranges for verification.

## Impact

### For aptos-core Contributors

- **Legacy Code Cleanup**: Enables core contributors to remove outdated features and code after 6 months of their deprecation, improving codebase maintainability.
- **Feature Flag Removal**: Allows for the removal of legacy feature flags, reducing technical complexity.
- **Improved Replay Verification Efficiency**: A shorter transaction history reduces the time and resources needed for replay verification during development.
- **Research Limitations**: Limited replayability restricts historical performance analysis using latest node binaries; however, developers can access archival nodes, the Aptos indexer, or set up an archival node via the restore service if needed.

### For Aptos ecosystem:

- **Replay Limitations**: Transactions older than 6 months may not be replay-able using latest node software.
    - **Mitigation**: Historical transactions will still be replayable using older software or the restore service, and a full archival node can be synced using output sync mode.
- **State Sync from Genesis**: Nodes may be unable to perform state synchronization by re-executing transactions from genesis due to incompatibilities with legacy formats.
    - **Mitigation**: Historical transactions will still be replayable using older software or the restore service, and a full archival node can be synced using output sync mode.
- **Indexing service:**
    - As Aptos removes legacy code after 6 months, indexing services will need to update their indexing logic and data processing pipelines to accommodate any changes in the transaction format or structure. This increases development cycles and may require tighter synchronization with Aptos protocol updates.

## Drawbacks

- A 6 months replayability limit may lead to faster protocol-level changes, requiring the ecosystem to adapt more frequently.
- Removing legacy code could increase operational complexity for validators and full node operators who wish to sync the entire transaction history. However this overhead should be minimal since Aptos node already provides output sync mode, which can be configured with a simple change. See details https://aptos.dev/en/network/nodes/configure/state-sync
- Limiting replayability could create barriers for research and performance testing. For example, if a new feature is introduced to improve performance, testing it against historical transactions would be limited to within the 6 months window. Additionally, research based on Aptos may often rely on transaction replay for data analysis, which would be constrained by this policy. This challenge may be mitigated through building new replay tooling which supports longer term execution replay-ability.

## Alternatives

- **Extended Replay Compatibility**: A longer compatibility window could be implemented but would increase system load for replay verification. If a compelling need arises to extend replayability beyond 6 months, this policy could be revisited.
- **Indefinite Compatibility**: Continuing indefinite replay support would allow backward compatibility but would require extensive maintenance of legacy code, increasing technical debt and slowing development, making it unsustainable long-term.

## Security Considerations

Introducing a 6 months limit on transaction replay compatibility carries both security benefits and challenges.

### **Reduction of Attack Surface**

- **Legacy Code Removal**: By allowing the removal of legacy code beyond the 6 months replay window, we can reduce the attack surface associated with outdated or deprecated functionality. This proactive cleanup can help prevent exploits that target obsolete features or unmaintained code.
- **Fewer Entry Points for Exploits**: Legacy code often contains older dependencies or workarounds that may not follow current security standards. By minimizing backward compatibility requirements, we can remove or refactor these potential vulnerabilities, improving the overall security posture of the network.

### **Operational Complexity for Node Operators**

- **Upgrade Requirements**: Node operators may need to manage more frequent software updates and perform state syncs with recent snapshots to remain secure and compatible with the network. This burden may introduce risks if operators do not stay current with recommended upgrades, potentially exposing them to security vulnerabilities. However, at the current state, validator and fullnode operator already required to keep most recent releases due to introduction of new features and other type of changes. This policy itself does not introduce more overhead than there already is.
- **State Sync Security**: Since state-sync may require operators to start from a recent snapshot, we would need secure snapshot and sync mechanisms to ensure nodes are not exposed to tampering or compromised state data. The current fast-sync mode already handle this situation.

### **Backup and Recovery Strategy**

- **Secure Backup of Historical Data**: Although this policy may limit replay compatibility, Aptos should continue to support secure backup solutions to store historical transaction data. These backups can be useful for recovery purposes, ensuring the integrity of the chain history. We need to make sure the restore service still functioning correctly with this policy change.

### **Community Awareness and Developer Security**

- **Clear Communication on Policy**: With the 6 months replay limit, developers and the community need to be informed of the implications for transaction compatibility. Transparent, timely communication about policy changes, deprecated features, and required upgrades can reduce the likelihood of unintentional vulnerabilities due to outdated knowledge or code.
