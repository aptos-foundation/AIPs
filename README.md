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

## AIP Overview

This table contains an overview of all created and tracked AIPs. It should be updated with each new AIP.

| Number | Layer | Title  | Type | Status|
|:---|:---|:---|:---|:---|
| AIP 0 | | [Aptos Improvement Proposals](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-0.md) | Informational | Accepted |
| [AIP 1](https://github.com/aptos-foundation/AIPs/issues/9) | Core | [Proposer selection improvements](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-1.md) | Standard | Accepted |
| [AIP 2](https://github.com/aptos-foundation/AIPs/issues/2) | Framework | [Multiple Token Changes](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-2.md) | Standard | Accepted |
| [AIP 3](https://github.com/aptos-foundation/AIPs/issues/3) | Framework | [Multi-step Governance Proposal](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-3.md) | Standard | Accepted |
| [AIP 4](https://github.com/aptos-foundation/AIPs/issues/15) | Framework | [Update Simple Map To Save Gas](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-4.md) | Standard | Accepted |
| AIP 5 | | N/A | | |
| [AIP 6](https://github.com/aptos-foundation/AIPs/issues/20) | Framework| [Delegation pool for node operators](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-6.md) | Standard | Accepted |
| [AIP 7](https://github.com/aptos-foundation/AIPs/issues/23) | Framework | [Transaction fee distribution](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-7.md) | Standard | Draft |
| [AIP 8](https://github.com/aptos-foundation/AIPs/issues/33) | Framework | [Higher-Order Inline Functions for Collections](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-8.md) | Standard | Accepted |
| [AIP 9](https://github.com/aptos-foundation/AIPs/issues/26) | Interface/ Framework | [Resource Groups](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-9.md) | Standard | Accepted|
| [AIP 10](https://github.com/aptos-foundation/AIPs/issues/27) | Framework | [Move Objects](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-10.md) | Standard | Accepted |
| [AIP 11](https://github.com/aptos-foundation/AIPs/issues/31) | Framework | [Digital Assets: Tokens as Objects](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-11.md) | Standard | Accepted |
|[AIP 12](https://github.com/aptos-foundation/AIPs/issues/50) | Framework | [Multisig Accounts v2](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-12.md) | Standard | Accepted |
| [AIP 13](https://github.com/aptos-foundation/AIPs/issues/24) | Framework | [Coin Standard Improvements](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-13.md) | Standard | Accepted |
| AIP 14 | Framework | [Update vesting contract](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-14.md) | Standard | Accepted |
| [AIP 15](https://github.com/aptos-foundation/AIPs/issues/28) | Framework | [Update and rename token_standard_reserved_properties](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-15.md) | Standard | Accepted |
| [AIP 16](https://github.com/aptos-foundation/AIPs/issues/57) | Framework | [New cryptography natives for hashing and MultiEd25519 PK validation](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-16.md) | Standard | Accepted |
| [AIP 17](https://github.com/aptos-foundation/AIPs/issues/79) | Core | [Reducing Execution Costs by Decoupling Transaction Storage and Execution Charges](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-17.md) | Standard | Accepted |
| [AIP 18](https://github.com/aptos-foundation/AIPs/issues/82) | Framework | [Introducing SmartVector and SmartTable to apto_std](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-18.md) | Standard | Accepted |
| [AIP 19](https://github.com/aptos-foundation/AIPs/issues/85) | Framework | [Enable updating commission_percentage in staking_contract module](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-19.md) | Standard | Accepted |
| [AIP 20](https://github.com/aptos-foundation/AIPs/issues/94) | Framework | [Generic Cryptography Algebra and BLS12-381 Implementation](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-20.md) | Standard | Accepted |
| [AIP 21](https://github.com/aptos-foundation/AIPs/issues/95) | Framework | [Fungible Assets](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-21.md) | Standard | Accepted |
| [AIP 22](https://github.com/aptos-foundation/AIPs/issues/101) | Framework | [No-Code Digital Assets (Token Objects)](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-22.md) | Standard | Accepted |
| [AIP 23](https://github.com/aptos-foundation/AIPs/issues/102) | Framework | [Make Ed25519 public key validation native return `false` if key has the wrong length](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-23.md) | Standard | Accepted |
| [AIP 24](https://github.com/aptos-foundation/AIPs/issues/103) | Framework | [Move Library Updates](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-24.md) | Standard | Accepted |
| [AIP 25](https://github.com/aptos-foundation/AIPs/issues/104) | Framework | [Transaction Argument Support for Structs](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-25.md) | Standard | Accepted |
| [AIP 26](https://github.com/aptos-foundation/AIPs/issues/108) | Core | [Quorum Store](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-26.md) | Standard | Accepted |
| [AIP 27](https://github.com/aptos-foundation/AIPs/issues/109) | Core | [Sender Aware Transaction Shuffling](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-27.md) | Standard | Accepted |
| [AIP 28](https://github.com/aptos-foundation/AIPs/issues/1170) | Framework | [Partial voting for on chain governance](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-28.md) | Standard | Accepted |
| [AIP 29](https://github.com/aptos-foundation/AIPs/issues/118) | Core | [Peer monitoring service](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-29.md) | Informational | Accepted |
| [AIP 30](https://github.com/aptos-foundation/AIPs/issues/119) | Framework | [Implement decrease in staking rewards](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-30.md) | Standard | Accepted |
| [AIP 31](https://github.com/aptos-foundation/AIPs/issues/121) | Framework | [Allowlisting for delegation pool](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-31.md) | Standard | On Hold |
| [AIP 32](https://github.com/aptos-foundation/AIPs/issues/127) | Core | [Storage Deletion Refund](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-32.md) | Standard | On Hold |
| [AIP 33](https://github.com/aptos-foundation/AIPs/issues/132) | Core | [Block Gas Limit](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-33.md) | Standard | Draft |
| [AIP 34](https://github.com/aptos-foundation/AIPs/issues/134)| Core | [Unit Gas Price Estimation](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-34.md) | Standard | Draft |
| [AIP 35](https://github.com/aptos-foundation/AIPs/issues/144)| Core | [Charging Invariant Violation Errors](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-35.md) | Standard | Accepted |
| [AIP 36](https://github.com/aptos-foundation/AIPs/issues/154)| Core | [Universally Unique Identifiers](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-36.md) | Standard | Draft |
| [AIP 37](https://github.com/aptos-foundation/AIPs/issues/160)| Core | [Filter duplicate transactions within a block](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-37.md) | Standard | Accepted |
| [AIP 38](https://github.com/aptos-foundation/AIPs/issues/163)| Core | [Deprecate Storage Gas Curves](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-38.md) | Standard | Draft |
| [AIP 39](https://github.com/aptos-foundation/AIPs/issues/173)| Core | [Separate gas payer](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-39.md) | Standard | Draft |
| [AIP 40](https://github.com/aptos-foundation/AIPs/issues/178)| Core | [Address Standard v1](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-40.md) | Standard | Draft |
| [AIP 41](https://github.com/aptos-foundation/AIPs/issues/185)| Framework | [Move APIs for randomness generation](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-41.md) | Standard | Draft |
| AIP 42 | Core | [Aptos TypeScript SDK V2](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-42.md) | Standard | Draft |
| [AIP 43](https://github.com/aptos-foundation/AIPs/issues/209) | Framework | [Parallelize Digital Assets (Token V2) minting/burning](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-43.md) | Standard | Draft |
| [AIP 44](https://github.com/aptos-foundation/AIPs/issues/200) | Core | [Module Events](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-44.md) | Standard | Draft |
| [AIP 46](https://github.com/aptos-foundation/AIPs/issues/222) | Framework | [New modules for ElGamal, Pedersen and Bulletproofs over Ristretto255](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-46.md) | Standard | Draft |
| [AIP 47](https://github.com/aptos-foundation/AIPs/issues/226) | Framework | [Aggregators V2 ](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-47.md) | Standard | Draft |
| [AIP 48](https://github.com/aptos-foundation/AIPs/issues/237) | Framework | [Allow direct commission change vesting contract](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-48.md) | Standard | Draft |
| [AIP 49](https://github.com/aptos-foundation/AIPs/issues/247) | Framework | [secp256k1 ECDSA for Transaction Authentication](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-49.md) | Standard | Draft |
| [AIP 50](https://github.com/aptos-foundation/AIPs/issues/249) | Framework | [Change Commission rates in delegation pools](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-50.md) | Standard | Draft |
| [AIP 51](https://github.com/aptos-foundation/AIPs/issues/251) | Framework | [Changing beneficiaries for operators ](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-51.md) | Standard | Draft |
| [AIP 52](https://github.com/aptos-foundation/AIPs/issues/258) | Framework | [Automated Account Creation for Sponsored Transactions](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-52.md) | Standard | Draft |
| [AIP 53](https://github.com/aptos-foundation/AIPs/issues/257) | Framework | [Make Fee Payer Address Optional in Transaction Authenticator](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-53.md) | Standard | Draft |
| ... | ... ||||

## Types of AIPs
* Standard: AIPs focusing on the changes to the Aptos blockchain.
* Informational: AIPs for the purpose of providing additional information, context, supporting details about Aptos blockchain.

## AIP Statuses
| Status | Description|
|:--|:--|
| `Draft` | Drafts are currently in process and not ready for review. No corresponding GH Issue will be created.|
| `In Review` | AIPs are ready for community review and feedback. See suggestions on providing feedback below. |
| `Ready for Review` | AIPs are ready for Gatekeeper review and feedback. |
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
