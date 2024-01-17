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
| [AIP-45](https://github.com/aptos-foundation/AIPs/issues/232) | Smart Contract | [Safe Burning of User-Owned Objects](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-45.md) | davidiw, movekevin, lightmark, bowenyang007, capcap, kent-white |
| [AIP-46](https://github.com/aptos-foundation/AIPs/issues/222) | Cryptography | [New modules for ElGamal, Pedersen and Bulletproofs over Ristretto255](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-46.md) | Michael Straka (michael@aptoslabs.com) |
| [AIP-47](https://github.com/aptos-foundation/AIPs/issues/226) | Core |[Aggregators V2](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-47.md)| georgemitenkov (https://github.com/georgemitenkov), vusirikala (https://github.com/vusirikala), gelash (https://github.com/gelash), igor-aptos (https://github.com/igor-aptos) |
| [AIP-48](https://github.com/aptos-foundation/AIPs/issues/237) | Smart Contract |[Allow direct commission change vesting contract](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-48.md)| wintertoro, movekevin, junkil-park |
| [AIP-49](https://github.com/aptos-foundation/AIPs/issues/247) | Cryptography |[`secp256k1` ECDSA for Transaction Authentication](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-49.md)| davidiw |
| [AIP-50](https://github.com/aptos-foundation/AIPs/issues/249) | Smart Contract | [Change Commission rates in delegation pools](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-50.md)| junkil-park, michelle-aptos, movekevin, wintertoro |
| [AIP-51](https://github.com/aptos-foundation/AIPs/issues/251) | Smart Contract |[Changing beneficiaries for operators](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-51.md)| junkil-park, michelle-aptos, movekevin, wintertoro |
| [AIP-52](https://github.com/aptos-foundation/AIPs/issues/258) | Core |[Automated Account Creation for Sponsored Transactions](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-52.md)| davidiw |
| [AIP-53](https://github.com/aptos-foundation/AIPs/issues/257) | Core | [Make Fee Payer Address Optional in Transaction Authenticator](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-53.md)| davidiw |
| [AIP-54](https://github.com/aptos-foundation/AIPs/issues/259) | Smart Contract | [Object code deployment](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-54.md)| movekevin, xbtmatt |
| [AIP-55](https://github.com/aptos-foundation/AIPs/issues/267) | Smart Contract | [Generalize Transaction Authentication and Support Arbitrary K-of-N MultiKey Accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-55.md)| davidiw, hariria |
| [AIP-56](https://github.com/aptos-foundation/AIPs/issues/270) | Move Lang | [Resource Access Control](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-56.md)| wrwg |
| [AIP-57](https://github.com/aptos-foundation/AIPs/issues/285) | Core | [Block Output Size Limit and Conflict-Aware Block Gas Limit](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-57.md)| igor-aptos |
| [AIP-58](https://github.com/aptos-foundation/AIPs/issues/286) | Gas | [Gas Schedule Adjustments](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-58.md)| igor-aptos, vgao1996 |
| [AIP-59](https://github.com/aptos-foundation/AIPs/issues/291) | Gas | [Storage IO Gas Adjustments](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-59.md)| msmouse |
| [AIP-60](https://github.com/aptos-foundation/AIPs/issues/298) | Gas | [Improve fairness of shared computation resources](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-60.md)| igor-aptos, vgao1996 |
| [AIP-61](https://github.com/aptos-foundation/AIPs/issues/) | Cryptography | [OpenID blockchain (OIDB) accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md)| Alin Tomescu |
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
