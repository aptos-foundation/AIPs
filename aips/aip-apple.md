---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Add Apple as a supported OIDC provider
author: Alin Tomescu (alin@aptoslabs.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/452
Status: Draft # | Last Call | Accepted | Final | Rejected>
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: <Standard (Core, Networking, Interface, Application, Framework) | Informational | Process>
created: 06/14/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md 
---

# AIP-X - Add Apple as a supported OIDC provider

## Summary

 > Summarize in 3-5 sentences.
 > Define the problem we're solving.
 > How does this document propose solving it.
 > What are the goals and what is in scope? Any metrics?

...

### Out of Scope

 > What are we committing to not doing and why are they scoped out?

...

## High-level Overview

 > Define the strawman solution with enough details to make it clear why this is the preferred solution.
 > Please write a 2-3 paragraph high-level overview here and defer writing a more detailed description in [the specification section](#specification-and-implementation-details).

...

## Impact

 > Which audiences are impacted by this change? What type of action does the audience need to take?
 > What might occur if we do not accept this proposal?

...

## Alternative solutions

There are no alternatives. 

The decision is binary: Do we (not) want to support keyless accounts backed by Apple accounts?

## Specification and Implementation Details

 > How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

...

## Reference Implementation

The governance proposal that will be submitted is:

```rust
script {
    use aptos_framework::aptos_governance;
    use aptos_framework::jwks;

    fun main(core_resources: &signer) {
        let core_signer = aptos_governance::get_signer_testnet_only(core_resources, @0x1);
        let framework_signer = &core_signer;

        jwks::upsert_oidc_provider(
            framework_signer,
            b"https://appleid.apple.com",
            b"https://appleid.apple.com/.well-known/openid-configuration"
        );

        aptos_governance::reconfigure(framework_signer);
    }
}
```

## Testing (Optional)

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out)
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

...

## Risks and Drawbacks

 > - Express here the potential risks of taking on this proposal. What are the hazards? What can go wrong?
 > - Can this proposal impact backward compabitibility?
 > - What is the mitigation plan for each risk or drawback?

## Security Considerations

 > - How can this AIP potentially impact the security of the network and its users? How is this impact mitigated?
 > - Are there specific parts of the code that could introduce a security issue if not implemented properly?
 > - Link tests (e.g. unit, end-to-end, property, fuzz) in the reference implementation that validate both expected and unexpected behavior of this proposal
 > - Include any security-relevant documentation related to this proposal (e.g. protocols or cryptography specifications)

...

## Future Potential

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in one year? In five years?

...

## Timeline

### Suggested implementation timeline

 > Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

...

### Suggested developer platform support timeline

 > Describe the plan to have SDK, API, CLI, Indexer support for this feature is applicable. 

...

### Suggested deployment timeline

 > Indicate a future release version as a *rough* estimate for when the community should expect to see this deployed on our three networks (e.g., release 1.7).
 > You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design review.
 >
 > - On devnet?
 > - On testnet?
 > - On mainnet?

...


## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should

...
