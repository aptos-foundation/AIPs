---
aip: 0
title: Aptos Improvement Proposals
authors: aptos-foundation
status: draft
type: Informational
created: 12/05/22
---

# AIP-0 - Aptos Improvement Proposals
Aptos Improvement Proposals (AIP) describe standards for the Aptos Network including the core blockchain protocol and the development platform (Move), smart contracts and systems for smart contract verification, standards for the deployment and operation of the Aptos Network, APIs for accessing the Aptos Network and processing information from the Aptos Network.

## The AIP Process

The formal AIP process will typically (and advisably) begin after the champion of the proposal has already discussed and socialized it with the Aptos community and Aptos Foundation. It is comprised of the following steps:

  * **Idea** – Authors will socialize their idea with the developer community and Aptos Maintainers, by writing a GitHub Issue and getting feedback. If possible (and relevant), authors should include in discussions an implementation to support their proposal.

    Once the discussion reaches a mature point, the formal AIP process starts with a pull-request to the aptos-foundation/AIPs folder. The status field of the document should be “Draft” at this point. AIP numbers are the same as the issue number from the initial proposal as assigned above. An AIP Manager will review/comment/approve/deny the pull-request, two maintainer approvals are required to commit the AIP draft into the AIP repo.

    * ✅ Draft – If agreeable, the AIP Managers approve the pull request.
    * 🛑 Draft – Reasons for denying Draft status include misalignment with Aptos mission or Aptos Foundation policy, being too unfocused, too broad, duplication of effort, being technically unjustified, not providing proper motivation, or not addressing backwards compatibility. The Authors can work to refine and resubmit their AIP Idea for review again.

  * **Draft** – After the draft is merged, additional changes may be submitted via pull requests. When an AIP appears to be completed and stable, Authors may ask to change the status to Review for sharing it more widely with the community.

    * ✅  Review – If agreeable, the AIP manager will approve the Review status and set a reasonable amount of time (usually 1-2 weeks) for a community review to collect Aptos community feedbacks. Additional time can be granted by the AIP Manager if requested.
    * 🛑  Review – A request for Review will be denied if material changes are still needed for the draft.

  * **Review** – After the draft is merged, AIP should be shared widely with the Aptos community to gather feedbacks. Additional changes may be submitted via pull requests. When an AIP appears to be completed and stable, Authors may ask to change the status to Last Call.

    * ✅  Accepted – A successful review without any material changes or unaddressed technical complaints will become Accepted. This status signals that material changes are unlikely and Aptos Maintainers should support driving this AIP for inclusion.
    * 🛑  Rejected – A request for Review will be denied if material changes are still needed for the draft, or if there is strong feedback from community to reject it, or a major, but uncorrectable, flaw was found in the AIP.

  * **Accepted** - An AIP in the Accepted state **means the Aptos Maintainer group has determined it** is ready for active implementation

    * ✅  Final – AIP is deployed to mainnet. When the implementation is complete and deployed/voted to mainnet the status will be changed to “Final”.
    * 🛑  Draft – If new information becomes available an Accepted AIP can be moved back into Draft status for necessary changes.
    * 🛑  Deprecated – The AIP Manager or Maintainers may mark a AIP Deprecated if it is superseded by a later proposal or otherwise becomes irrelevant.

  * **Final** – The Final state of a AIP means the necessary implementations of the AIP are complete and deployed to the Aptos Mainnet. This AIP represents the current state-of-the-art. A Final AIP should only be updated to correct errata.

An AIP may refer to related/dependent AIPs. Every AIP will be assigned a status tag as it evolves. At every stage there can be multiple revisions/reviews until the next stage.
