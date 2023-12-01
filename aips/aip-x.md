---
aip: 
title: Digital Assets Composability
author: TowneSquare.
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: <Draft>
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: <Standard (Core, Networking, Interface, Application, Framework)>
created: <12/01/2023>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <10, 11, 21, 43, 44, 47>
---

# AIP-X - Composable Digital Assets standard

## Summary

Digital asset creators face challenges due to the lack of a standardized approach to composability. This leads to either manual implementation with limited customization and potential security risks, or ignoring the real benefits of the digital and fungible assets standards.

Our solution introduces a standardized composability infrastructure that leverages the object model. This ensures composability logic execution upon assets transfers, preventing internal state violations. Additionally, a no-code solution empowers creators without compromising customization options.

### Goals

The primary goal of this solution is to establish a standardized and secure approach to composability for digital assets, allowing digital assets to hold other digital assets and fungible assets. This will address the following challenges:

- **Enhance the use of the digital/fungible assets standards:** Creators will have greater control over the customization of their composable digital assets (meaning they can equip them with trait digital assets or fungible assets like cryptocurrencies), allowing for more creativity setups and use cases.

- **Mitigate security risks:** The enforcement of composability logic will minimize the potential for security vulnerabilities, more precisely when managing the references for the digital assets.

The scope of this solution encompasses a standardized set of protocols will be defined to ensure interoperability and compatibility between composable digital assets, trait digital assets.

### Out of Scope

The solution focuses on providing the underlying infrastructure for composability, rather than developing specific applications.

The reasons is because such limitation allows us to focus on developing the core functionality of composability and ensuring it is done to the highest standards of quality and security. Additionally, by excluding specific applications, we encourage community members to develop their own innovative applications on top of our standardized composability modules.

## Motivation

[draft]

creators are now able to create a digital asset that is a combination of multiple digital assets and funigible assets using ni-code solutions.

The current lack of standardization creates several challenges for creators and the overall ecosystem:

- **Creator Burden:** Creators are currently responsible for manually implementing composability features, which can be time-consuming and error-prone. This limits the ability of creators to focus on innovation and creativity.

- **Limited Customization:** Existing composability solutions often provide limited customization options, forcing creators to adapt their ideas to fit the constraints of the framework. This stifles creativity and innovation.

- **Security Risks:** The lack of standardization and enforcement of composability logic can introduce security vulnerabilities, putting both creators and users at risk.

The proposed solution addresses these challenges by providing a standardized and secure approach to composability:

- **Reduced Creator Burden:** The no-code composability toolkit will significantly reduce the time and effort required for creators to implement composability features, freeing them up to focus on innovation and creativity.

- **Enhanced Customization:** Creators will have greater control over the customization of their composable digital assets, enabling them to bring their creative ideas to life.

- **Mitigated Security Risks:** The standardized approach and enforcement of composability logic will minimize the potential for security vulnerabilities, protecting both creators and users.

If the proposed solution is not accepted, the following consequences are likely to occur:


**Elevated Security Risks:** The lack of standardization of composability logic will require creators to carfully handle references depending on their needs. Failing to do so could result in potentioally losing the ownership of the digital assets.

## Impact

[draft]

Audience 1: Digital Asset Creators, Marketplace Operators, and Ecosystem Participants

Impact: The proposed change will significantly impact digital asset creators by providing them with a standardized and easy-to-use framework for implementing composability features. This will reduce their burden, enhance their ability to customize their tokens, and mitigate security risks.

Action: Creators are encouraged to adopt the proposed framework and leverage the provided no-code toolkit to streamline their composability development process. This will allow them to focus on innovation and creativity while ensuring their tokens adhere to industry standards.

Marketplace Operators

Impact: The proposed change will impact digital asset marketplace operators by enabling them to support a broader range of composable digital assets and facilitate secure transactions between users. This will enhance the overall functionality and security of their platforms.

Action: Marketplace operators should integrate the proposed framework into their platforms to support composable digital assets. They should also provide user education and support to ensure users understand the benefits and risks of composable digital assets.

Ecosystem Participants

Impact: The proposed change will impact the broader digital asset ecosystem by fostering interoperability, innovation, and security. This will contribute to the overall growth and maturity of the ecosystem.

Action: Ecosystem participants, including developers, researchers, and enthusiasts, should actively engage with the proposed framework and contribute to its development and adoption. This will help ensure that the framework remains aligned with the evolving needs of the ecosystem.

Audience 2: Fungible asset holders

## Alternative solutions

[draft]

 > Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

...

we believe the proposed solution is the best possible outcome, considering alternative solutions:

- Continue with the status quo: This would involve maintaining the current lack of standardization and reliance on manual composability implementation by creators. This approach would perpetuate the existing challenges of creator burden, limited customization, and elevated security risks.

- Develop multiple competing composability frameworks: This approach would fragment the ecosystem, creating compatibility issues and hindering interoperability between composable digital assets. It would also increase the complexity for creators, who would need to choose and learn different frameworks.

- Establish a de facto standard through market adoption: This approach would rely on organic adoption of a particular framework without formal standardization. This could lead to a scenario where the adopted framework may not be the most optimal or secure solution.

on the other hand, the proposed solution provides:

- Standardized and Secure Approach: The proposed solution provides a standardized and secure approach to composability, addressing the key challenges of the status quo.

- No-Code Toolkit: The no-code toolkit empowers creators with a user-friendly tool, reducing their burden and enhancing their ability to customize their tokens.

- Integration with Existing Platforms: The solution's compatibility with existing platforms ensures a smooth transition for creators and marketplace operators.

## Specification

[draft]

 > How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

...

Not all digital assets should be able to hold other digital asset as this may result in a cylic holding of digital assets. To prevent this,  we introduced a new subtype of token called 'composable,' which differs from the other type, named 'trait,' in terms of composability. This means that only composable digital assets can hold trait digital assets, and not the other way around. However, both digital asset subtypes can hold fungible assets. 

So in short, the composable can hold the trait, but not the other way around. Both types can hold fungible assets.

a composable can hold - or equip - a trait, means that this composable is now the owner of the trait. But trait is still indirectly owned by the owner of both the composable and the trait. This means that the owner of the composable can transfer - or manage - the composable and what's being owned by it.
Moreover, if a trait is equiped in a composable, it will "stick" to the composable and will wherever that composable is being transfered (`ungated transfer is off`). This is enforced unltill that trait is unequipped from the composable. And it is achieved by associating the necessary references in a resource that is stored under the digital asset itself upon creation. This ensures that composability logic is always executed when a token is transferred, preventing any transfers that could violate the internal state of the composability logic. But fungible assets can be allocated to either of these digital assets (composable, trait). 

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.

...

link them to our studio would work.

## Testing (Optional)

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out)
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

...

## Risks and Drawbacks

 > - Express here the potential negative ramifications of taking on this proposal. What are the hazards?
idk

 > - Any backwards compatibility issues we should be aware of?
No, this standard will be build on top of existing standards and without making any changes to them.

 > - If there are issues, how can we mitigate or resolve them?
updating URI.
...

## Future Potential

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in in one year? In five years?

...
- gaming areas.
- managing passes, tickets and coupons.

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
 One potential security that I can think of, relies to the way the URI of a composable digital asset is updated. If this is done off chain, then this could open the door for a potential scam. To mitigate this, we can enforce that the URI link is generated on chain.
 > - Any security implications/considerations?
 > - Any security design docs or auditing materials that can be shared?

## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should

 how to generate a uri onchain based a given order? 
