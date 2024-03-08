---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Prover Service for Aptos Keyless Accounts
author: Rex Fernando, Alin Tomescu
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: <Standard (Core, Networking, Interface, Application, Framework) | Informational | Process>
created: <mm/dd/yyyy>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Prover Service for Aptos Keyless Accounts

## Summary

This AIP is an extension of [AIP-61](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md): Keyless Accounts, which allow users to have a wallet which is tied to an OpenID account, and to authenticate with the blockchain via their OIDC provider. As summarized in AIP-61, “your blockchain account = your OIDC account”. OpenID authenticates users based on personally-identifying information, e.g. an email address or a twitter handle. We want to guarantee:

- The OpenID provider does not learn which wallets are linked to which users.
- The validators (and other outside observers) also cannot learn the link between wallets and OpenID users.

In order to do this, we are using a zero-knowledge proof which each user must provide to validators to authenticate transactions. Generating such a proof must be done each time a user logs in, and then each time the user's ephemeral public key[^epk], and is computationally intensive. To allow for users to login quickly and on low-powered hardware, we plan to offload this proof computation to a proving service.

### Goals

1. Enable Keyless account users to login quickly and without friction. 
2. Respect users' privacy as much as possible.
3. Build a service that is relatively inexpensive host.
4. Protect against bugs in the zero-knowledge system.

## Motivation

The motivation of this AIP follows directly from the motivation of [AIP-61](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md). The purpose of Aptos Keyless is to greatly reduce friction in onboarding and key management for users. Specifically, the Keyless Proving Service will allow for the most computationally intensive step during login to be offloaded to a powerful cloud VM instead of being done locally, thus greatly improving the user experience of Aptos Keyless.
 
### Out of Scope

 > What are we committing to not doing and why are they scoped out?

We are not trying to solve the issue of privacy between the user and the prover service. That is, we are *allowing* the prover service to learn the user's private information, including:
* The user's OIDC handle. For example, if logging in with Google, the prover service will learn the user's email.
* The user's privacy-preserving pepper [link to aip-61 here].

The fact that the prover service learns this information induces privacy and centralization risks. These risks are discussed [below](##Risks and Drawbacks).



## Impact

 > Which audiences are impacted by this change? What type of action does the audience need to take?

...

## Alternative solutions

 > Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

The most obvious alternative is requiring the user to generate a proof client-side. From preliminary benchmarks, doing this in-browser takes such a long time that is completely unusable. (i.e., > 25 seconds to generate the proof.)

## Specification

 > How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

...

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.

...

## Testing (Optional)

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out)
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

...

## Risks and Drawbacks

 > - Express here the potential negative ramifications of taking on this proposal. What are the hazards?
 > - Any backwards compatibility issues we should be aware of?
 > - If there are issues, how can we mitigate or resolve them?

- If we don’t sufficiently optimize the circuit and prover code, the prover service could be cost-prohibitive to scale.
    - Solution: robust benchmarks of prover, understanding of cost involved in running the service
- Currently, the prover service learns all
-

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

## Security Considerations

 > - Does this result in a change of security assumptions or our threat model?
 > - Any potential scams? What are the mitigation strategies?
 > - Any security implications/considerations?
 > - Any security design docs or auditing materials that can be shared?

...

## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should

...

## References

[^epk]: https://github.com/rex1fernando/AIPs/blob/main/aips/aip-61.md#specification)https://github.com/rex1fernando/AIPs/blob/main/aips/aip-61.md#specification
