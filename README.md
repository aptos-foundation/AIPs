<img width="1001" alt="Aptos Foundation_BLK" src="https://github.com/aptos-foundation/AIPs/assets/15336794/7e529eea-3a7d-465f-b889-3ce52f5fe8ff">

# Aptos Improvement Proposals (AIPs)

Aptos Improvement Proposals (AIP) describe standards for the Aptos Network including the core blockchain protocol and the development platform (Move), smart contracts and systems for smart contract verification, standards for the deployment and operation of the Aptos Network, APIs for accessing the Aptos Network and processing information from the Aptos Network.

AIPs are intended to cover changes that impact active services within the Aptos ecosystem. In lieu of another medium for posting community proposals, the AIP issue tracker can be used to store exploratory proposals. Though please consider first whether or not the [Aptos-Core](https://github.com/aptos-labs/aptos-core/issues) may be a better location for such discussions.

To vote on AIPs impacting the state of the Blockchain, go to https://governance.aptosfoundation.org/.

## How to submit an AIP

 1. Fork this repo into your own GitHub
 2. Copy [`TEMPLATE.md`](TEMPLATE.md) into your new AIP file in `aips/aip-xxx-<slug>.md`
    + Name your AIP file using the format `aip-<NNN>-<slug>.md`, where `<NNN>` is a zero-padded 3-digit number and `<slug>` is a short kebab-case summary of the title.
    + e.g., `aip-061-keyless-accounts.md` or `aip-143-confidential-apt.md`.
    + When first drafting, use `aip-xxx-<slug>.md` as a placeholder — the AIP manager will assign the final number.
 3. Edit your AIP file
    - Fill in the YAML header (see instructions there)
    - Follow the template guidelines to the best of your ability
 4. Commit these changes to your repo
 5. Submit a pull request on GitHub to this repo.
 6. To start discussing your AIP, create a GH Issue for your AIP using the default Issue template

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
