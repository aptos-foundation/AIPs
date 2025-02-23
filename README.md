<img width="1001" alt="Aptos Foundation_BLK" src="https://github.com/aptos-foundation/AIPs/assets/15336794/7e529eea-3a7d-465f-b889-3ce52f5fe8ff">

# Aptos Improvement Proposals (AIPs)

Aptos Improvement Proposals (AIP) describe standards for the Aptos Network including the core blockchain protocol and the development platform (Move), smart contracts and systems for smart contract verification, standards for the deployment and operation of the Aptos Network, APIs for accessing the Aptos Network and processing information from the Aptos Network.

AIPs are intended to cover changes that impact active services within the Aptos ecosystem. In lieu of another medium for posting community proposals, the AIP issue tracker can be used to store exploratory proposals. Though please consider first whether or not the [Aptos-Core](https://github.com/aptos-labs/aptos-core/issues) may be a better location for such discussions.

To vote on AIPs impacting the state of the Blockchain, go to https://governance.aptosfoundation.org/.

## How to submit an AIP

 1. Fork this repo into your own GitHub
 2. Copy [`TEMPLATE.md`](TEMPLATE.md) into your new AIP file in `aips/<your-feature-name-NO-AIP-#-here>.md`
    + Name your AIP file based on your feature, not the AIP number, which will be picked for your later.
    + e.g., `new-zero-knowledge-range-proof-verifiers.md` is a good name.
    - ...but `aip-14.md` or `14.md` is **NOT** a good name.
 3. Edit your AIP file
    - Fill in the YAML header (see instructions there)
    - Follow the template guidelines to the best of your ability
 4. Commit these changes to your repo
 5. Submit a pull request on GitHub to this repo.
 6. To start discussing your AIP, create a GH Issue for your AIP using the default Issue template

## AIP Index

Note: This is a subset of all the AIPs -- to see the full list of AIPs, please [click here](https://github.com/aptos-foundation/AIPs/wiki/Index-of-AIPs).

| Number | Category | Title  | Author |
|:---|:---|:---|:---
| [AIP-109](https://github.com/aptos-foundation/AIPs/issues/545) | Framework | [Hide Unwanted Soulbound Objects](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-109.md)| gregnazario |
| [AIP-110](https://github.com/aptos-foundation/AIPs/issues/551) | Governance | [Lower the Threshold for Passing a Governance Proposal from 400M APT to 300M APT](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-110.md)| sherry-x |
| [AIP-111](https://github.com/aptos-foundation/AIPs/issues/555) | Blockchain | [Transaction Execution Replay Backward Compatibility Policy](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-111.md)| sherry-x |
| [AIP-112](https://github.com/aptos-foundation/AIPs/issues/562) | Standard Language | [Function Values in the Move VM](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-112.md)| Wolfgang Grieskamp |
| [AIP-113](https://github.com/aptos-foundation/AIPs/issues/563) | Framework | [Domain-based Account Abstraction](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-113.md)| igor-aptos, lightmark |
| [AIP-114](https://github.com/aptos-foundation/AIPs/issues/564) | Framework | [Increase Coin Symbol Byte Length](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-114.md)| gregnazario |
| ... | ... |||

## Types of AIPs
* Standard: AIPs focusing on the changes to the Aptos blockchain.
* Informational: AIPs for the purpose of providing additional information, context, supporting details about Aptos blockchain.

## AIP Statuses
| Status | Description|
|:--|:--|
| `Draft` | Drafts are currently in process and not ready for review. No corresponding GH Issue will be created.|
| `In Review` | AIPs are ready for community review and feedback. See suggestions on providing feedback below. |
| `Ready for Approval` | AIPs are ready for Gatekeeper approval and feedback. |
| `Accepted `| AIPs has been accepted and will be implemented soon. |
| `Rejected` | A community decision has been made to not move forward with an AIP at this time.| 
| `On Hold` | Some information is missing or prerequisites have not yet been completed. | 

## Category
* Framework
* Core (Blockchain)
* Gas
* Cryptography
* Ecosystem

## Providing Feedback on an AIP
* Follow the discussion in the corresponding AIP issue
* If you were designing this change, what would you want to communicate? Is it being communicated in the AIP?
* As a community member, how are you impacted by this change? Does it provide enough information about the design and implementation details to assist with decision making?

## Notice regarding rejected or stale AIPs
* If an AIP Author is not actively engaging in their PR's and Issues, they will be closed after 14 days due to inactivity.
* If an AIP has been rejected, please review the feedback provided for further guidance.
