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
| [AIP-76](https://github.com/aptos-foundation/AIPs/issues/402) | Smart Contract | [Digital Assets Composability](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-76.md)| aladeenb, jczhang |
| [AIP-77](https://github.com/aptos-foundation/AIPs/issues/409) | Smart Contract | [Multisig V2 Enhancement](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-77.md)| junkil-park (https://github.com/junkil-park), movekevin (https://github.com/movekevin) |
| [AIP-78](https://github.com/aptos-foundation/AIPs/issues/406) | Smart Contract | [Aptos Token Objects Framework Update](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-78.md)| johnchanguk |
| [AIP-79](https://github.com/aptos-foundation/AIPs/issues/407) | Cryptography | [Implementation of instant on-chain randomness](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-79.md)| Alin Tomescu (alin@aptoslabs.com), Zhuolun "Daniel" Xiang (daniel@aptoslabs.com), Zhoujun Ma (zhoujun@aptoslabs.com) |
| [AIP-80](https://github.com/aptos-foundation/AIPs/issues/405) | Ecosystem | [Standardize Private Keys](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-80.md)| Greg Nazario - greg@aptoslabs.com |
| [AIP-81](https://github.com/aptos-foundation/AIPs/issues/419) | Cryptography | [Pepper service for keyless accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-81.md)| Zhoujun Ma (zhoujun@aptoslabs.com) |
| [AIP-82](https://github.com/aptos-foundation/AIPs/issues/XXX) | Smart Contract | [Transaction context extension](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-82.md)| junkil-park (https://github.com/junkil-park), lightmark (https://github.com/lightmark), movekevin (https://github.com/movekevin) |
| [AIP-83](https://github.com/aptos-foundation/AIPs/issues/421) | Framework | [Framework-level Untransferable Fungible Asset Stores](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-83.md)| davidiw |
| [AIP-84](https://github.com/aptos-foundation/AIPs/issues/427) | Gas | [Improving Gas Coverage](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-84.md)| vgao1996 |
| [AIP-85](https://github.com/aptos-foundation/AIPs/issues/441) | Framework | [Improve APT FA performance](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-85.md)| igor-aptos |
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
