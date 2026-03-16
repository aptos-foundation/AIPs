---
aip: 98
title: Reduce minimal stake required to submit governance proposal from 10M to 1M
author: sherry-x
discussions-to: https://github.com/aptos-foundation/AIPs/issues/502
Status: Accepted
last-call-end-date:
type: Standard (Framework)
created: 2024/09/17
updated: 
requires:
---

# AIP 98 - Reduce minimal stake required to submit governance proposal from 10M to 1M

## Summary

This proposal aims to lower the minimum stake required to submit a governance proposal in the Aptos Network from 10M APT to 1M APT. The current threshold was initially designed to prevent spam and ensure only well-considered proposals are submitted. However, as the Aptos ecosystem decentralizes and more APT tokens are distributed, fewer validators hold 10M APT, limiting participation in governance.

By reducing the threshold, we can further decentralize the network, stimulate innovation, and empower a wider range of stakeholders, particularly smaller validators and new participants, to propose changes that can benefit the broader ecosystem.

While this reduction carries some risks, such as the potential for an increase in low-quality proposals, these can be mitigated through governance process improvements. Ultimately, the proposal aims to balance the need for decentralization with maintaining a robust and efficient governance framework.

## Background

The Aptos on-chain [governance](https://aptos.dev/en/network/blockchain/governance) is a process by which the Aptos community members can create and vote on proposals that minimize the cost of blockchain upgrades. This is the high level process:

- The Aptos community can suggest an Aptos Improvement Proposal (AIP) in the [Aptos Foundation AIP GitHub](https://github.com/aptos-foundation/AIPs).
- When appropriate, an on-chain proposal can be created for the AIP via the `aptos_governance` module. The proposal can be submitted by any voters with more than 10M APT stakes.
- Voters can then vote on this proposal on-chain via the `aptos_governance` module. If there is sufficient support for a proposal, then it can be resolved.

In this AIP, we’re discussing updating the requirement for submitting the on-chain proposal. It does not impact who can suggest an AIP, nor who can vote for a proposal.

## High Level Approach

With this AIP, we propose to change the `required_proposer_stake` from 10M APT to 1M APT. This approach has several benefits:

- **Encouraging Greater Participation:** By lowering the proposing threshold, a broader range of participants, including smaller validators and independent stakeholders, will have the opportunity to submit governance proposals. This can increase overall engagement and inclusivity within the Aptos ecosystem.
- **Further Decentralization:** Keeping the proposing threshold high concentrates proposal power among a small group of large validators. Reducing it helps distribute power more evenly across the network, reducing the risk of centralization and enhancing the network’s resilience.
- **Fostering Innovation:** A lower stake requirement can encourage diverse ideas and solutions from a wider pool of contributors, potentially leading to more innovative and creative governance proposals that better address the needs of the community.
- **Improving Responsiveness:** With a more diverse set of proposers, governance can respond more quickly to issues or opportunities arising in the ecosystem. This agility is crucial for adapting to changes in technology, market conditions, and user needs.
- **Building Community Trust:** By lowering barriers to participation, the Aptos governance framework can foster a sense of ownership and trust within the community. When more stakeholders feel their voice can be heard, it strengthens the Aptos governance process.

Lowering to 1M seems to be a good balance. The minimal stake required to join Aptos Validator Set is also 1M APT. This is high enough to prevent malicious actors but low enough to allow much more participants compares to the current state. 

## Impact

**For the Governance Proposer** 

Lowering the threshold to 1M APT will open up the governance process to a wider range of stakeholders, allowing smaller validators, developers, and individual participants to submit proposals. This increases access for those who were previously excluded due to the high 10M APT requirement, fostering a more diverse set of proposers.

**For the Individual Voter**

- There’s no change on the requirement to participate in voting.
- With more proposers being able to submit changes, individual voters will have to stay more engaged in the governance process. This could increase the time and effort required to review, understand, and vote on each proposal, potentially leading to voter fatigue.
- A wider range of proposers means that individual voters will have the opportunity to influence decisions on a more diverse set of issues within the Aptos ecosystem. This could result in more nuanced improvements to the network that reflect the varied interests of the community.

## Implementation Details

This would be a simple configuration change in Aptos Framework. 

```
script {
    use aptos_framework::aptos_governance;

    fun main(proposal_id: u64) {
        let framework_signer = aptos_governance::resolve_multi_step_proposal(proposal_id, @0x1, vector::empty<u8>());
        aptos_governance::update_governance_config(
            &framework_signer,
            aptos_governance::get_min_voting_threshold(),
            100000000000000,
            aptos_governance::get_voting_duration_secs(),
        );
    }
}
```

## Risk and Drawbacks

- **Increased Spam or Low-Quality Proposals -** Lowering the threshold could lead to an influx of proposals that may not be thoroughly vetted or impactful, as the barrier to entry is reduced. This could clutter the governance process with low-quality proposals, consuming time and resources to evaluate and vote on them.
- **Potential for Exploitative Behavior -** A lower proposing threshold might make it easier for malicious actors to submit proposals that could exploit vulnerabilities in the system, especially if they can more easily meet the new, lower stake requirement. This may increase the need for more stringent proposal review processes.
- **Increased Governance Overhead -** With more proposals being submitted, the burden on the community to review, discuss, and vote on a higher volume of governance items could grow. This may lead to slower decision-making, voter fatigue, or reduced participation in governance, particularly on critical issues.

### Mitigation
Currently, the Aptos Network follows the Aptos Improvement Process (AIP) for network updates. To address associated risks, we need to further strengthen the review process while maintaining a high standard of quality.

- Set up alerts for when a new proposal is submitted on-chain (this feature already exists, and the ecosystem can subscribe through Govscan notifications at https://govscan.live/settings).
- The Aptos Maintainers and Aptos Foundation should review new proposals within 3 days to ensure they adhere to the AIP process. Proposals that do not comply with the AIP process will be rejected by the Aptos Foundation and must be resubmitted in accordance with the Aptos Improvement Process.
- Proposals that fail to gain sufficient support will not pass governance and, consequently, will not be executed. This is safeguarded by our minimum proposal passing requirement.

## Timeline

- Going through review in September and submit to Mainnet early October.
