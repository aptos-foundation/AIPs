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

| Number | Theme | Title  | Author |
|:---|:---|:---|:---
| [AIP-61](https://github.com/aptos-foundation/AIPs/issues/) | Cryptography | [OpenID blockchain (OIDB) accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md)| Alin Tomescu |
| [AIP-62](https://github.com/aptos-foundation/AIPs/issues/297) | Devex | [Wallet Standard](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-62.md)| 0xmaayan, hardsetting, NorbertBodziony |
| [AIP-63](https://github.com/aptos-foundation/AIPs/issues/297) | Smart Contract | [Coin to Fungible Asset Migration](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-63.md)| lightmark, davidiw, movekevin |
| [AIP-64](https://github.com/aptos-foundation/AIPs/issues/297) | Blockchain | [Validator Transaction Type](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-64.md)| zhoujun@aptoslabs.com, daniel@aptoslabs.com |
| [AIP-65](https://github.com/aptos-foundation/AIPs/issues/297) | Gas | [Storage Fee for State Bytes refundable](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-65.md)| msmouse |
| [AIP-66](https://github.com/aptos-foundation/AIPs/issues/297) | Cryptography | [Passkey Accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-66.md)| hariria |
| [AIP-67](https://github.com/aptos-foundation/AIPs/issues/331) | Cryptography | [Native Consensus for JSON Web Key (JWK)](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md)| Zhoujun Ma (zhoujun@aptoslabs.com) |
| [AIP-68](https://github.com/aptos-foundation/AIPs/issues/333) | Blockchain | [Reordering transactions in a block for fairness](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-68.md)| igor-aptos |
| [AIP-69](https://github.com/aptos-foundation/AIPs/issues/349) | Smart Contract | [Start replication of Google JWKs on chain](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-69.md)| Zhoujun Ma (zhoujun@aptoslabs.com) |
| [AIP-70](https://github.com/aptos-foundation/AIPs/issues/359) | Smart Contract | [Parallelize Fungible Assets](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-70.md)| igor-aptos (https://github.com/igor-aptos), vusirikala (https://github.com/vusirikala) |
| [AIP-71](https://github.com/aptos-foundation/AIPs/issues/367) | Smart Contract | [Refactor Aptos Framework Events with Module Events](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-71.md)| lightmark |
| [AIP-72](https://github.com/aptos-foundation/AIPs/issues/370) | Devex | [Minting Standard for Digital Assets](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-72.md)| johnchanguk, jillxuu, briungri, bowenyang007 |
| [AIP-73](https://github.com/aptos-foundation/AIPs/issues/374) | Smart Contract | [Dispatchable token standard](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-73.md)| Runtian Zhou |
| [AIP-74](https://github.com/aptos-foundation/AIPs/issues/375) | Blockchain | [Increase block gas limit to account for concurrency increase](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-74.md)| Sital Kedia (skedia@aptoslabs.com), Igor Kabiljo (ikabiljo@aptoslabs.com) |
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

## Layer
* Framework
* Core (Blockchain)
* Gas
* Cryptography
* Platform

## Providing Feedback on an AIP
* Follow the discussion in the corresponding AIP issue
* If you were designing this change, what would you want to communicate? Is it being communicated in the AIP?
* As a community member, how are you impacted by this change? Does it provide enough information about the design and implementation details to assist with decision making? 

## Notice regarding rejected or stale AIPs
* If an AIP Author is not actively engaging in their PR's and Issues, they will be closed after 14 days due to inactivity.
* If an AIP has been rejected, please review the feedback provided for further guidance.
