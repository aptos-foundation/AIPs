---
aip: 
title: Digital Assets Composability
author: TowneSquare.
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Core, Networking, Interface, Application, Framework)
created: 12/01/2023
updated (*optional): 12/04/2023
requires (*optional): 10, 11, 21, 43, 44, 47
---

# AIP-X - Composable Digital Assets standard

## Summary

Digital asset creators face challenges due to the lack of a standardized approach to composability. This leads to either manual implementation with limited customization and potential security risks, or ignoring the real benefits of the digital and fungible assets standards.

Our solution introduces a standardized composability infrastructure that leverages the object model. This ensures composability logic execution upon assets transfers, preventing internal state violations.

### Goals

We believe creators should not worry about implementing the actual code to manage composability. The primary goal of this solution is to establish a standardized and secure approach to composability for digital assets, allowing them to hold other digital assets and fungible assets. This will address the following challenges:

- **Enhance the use of the digital/fungible assets standards:** Creators will be able to leverage the power of the new standards in a couple of clicks with straightforward steps. They will also have control over the customization of their composable digital assets (meaning they can equip them with trait digital assets or fungible assets like cryptocurrencies), allowing for more creativity setups and use cases.

- **Mitigate security risks:** The enforcement of composability logic will minimize the potential for security vulnerabilities, more precisely when managing transfer reference for the digital assets.

The scope of this solution encompasses a standardized set of protocols will be defined to ensure interoperability and compatibility between composable digital assets and trait digital assets.

### Out of Scope

The solution focuses on providing the underlying infrastructure for composability, rather than developing specific applications.

The reasons is because such limitation allows us to focus on developing the core functionality of composability and ensuring it is done to the highest standards of quality and security. Additionally, by excluding specific applications, we encourage community members to develop their own innovative applications on top of our standardized composability modules.

## Motivation

creators are now able to create a digital asset that is a combination of multiple digital assets and funigible assets using ni-code solutions.


The current lack of standardization creates several challenges for creators and the overall ecosystem:

- **Creator Burden:** Creators are currently responsible for manually implementing composability features, which can be time-consuming, resource consuming and error-prone. This limits the ability of creators to focus on innovation and creativity.

- **Security Risks:** The lack of standardization and enforcement of composability logic can introduce security vulnerabilities, putting both creators and users at risk.


- The proposed solution addresses these challenges by providing a standardized and secure approach to composability:

- **smooth creation process:** The no-code composability toolkit will significantly reduce the time and effort required for creators to implement composability features, freeing them up to focus on innovation and creativity.

- **Enhanced Customization:** Creators will have greater control over the customization of their composable digital assets, enabling them to bring their creative ideas to life.

- **Mitigated Security Risks:** The standardized approach and enforcement of composability logic will minimize the potential for security vulnerabilities, protecting both creators and users.


If the proposed solution is not accepted, the following consequences are likely to occur:
- **not the ease of use feature:** Creators will continue to face the burden of manually implementing composability features, limiting their ability to focus on other relevant aspects. 

- **Elevated Security Risks:** The lack of standardization of composability logic will require creators to carfully handle references depending on their needs. Failing to do so could result in potentioally losing the ownership of the digital assets.

## Impact

TODO

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

TODO

 > Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

...

Composability using `aptos_object_token.move`:

A lot of you may argue that aptos_object_token.move serves the need, as a no-code solution so by calling a couple of functions from `object.move` one can achieve the goal. However, creating an digital asset using that module (return all refs and we don't need all of them). Moreover, the URI for a composable digital asset **should not** be inputted by the creator. Instead, it should be a third part image generator, or even better, on chain. This is because the URI of a composable digital asset is not static and it changes based on the digital assets that are being held by it. For example, if a composable digital asset is holding a trait digital asset, then the URI of the composable digital asset should be updated to reflect that.

Moreover, to not violate the internal state of the composability logic, digital assets have to be categorised into subtypes. This is to help identify which digital asset can be composed into another digital asset. If using `aptos_object_token.move` approach is taken, we would end up generating another object inside the AptosToken object, which is not ideal.  

TODO: table comparing `aptos_object_token.move` and `studio/core.move`

we believe the proposed solution is the best possible outcome, considering alternative solutions:

- Continue with the status quo: This would involve maintaining the current lack of standardization and reliance on manual composability implementation by creators. This approach would perpetuate the existing challenges of creator burden, limited customization, and elevated security risks.

- Develop multiple competing composability frameworks: This approach would fragment the ecosystem, creating compatibility issues and hindering interoperability between composable digital assets. It would also increase the complexity for creators, who would need to choose and learn different frameworks.

- Establish a de facto standard through market adoption: This approach would rely on organic adoption of a particular framework without formal standardization. This could lead to a scenario where the adopted framework may not be the most optimal or secure solution.

on the other hand, the proposed solution provides:

- Standardized and Secure Approach: The proposed solution provides a standardized and secure approach to composability, addressing the key challenges of the status quo.

- No-Code Toolkit: The no-code toolkit empowers creators with a user-friendly tool, reducing their burden and enhancing their ability to customize their tokens.

- Integration with Existing Platforms: The solution's compatibility with existing platforms ensures a smooth transition for creators and marketplace operators.

## Specification

TODO

 > How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

...

- talk about subtypes of digital assets
- talk about digital assets dissamination: each subtype will have its own logic, although they will be similar and have a lot of common logic
- talk about refs; transfers; and how to update the uri

Not all digital assets should be able to hold other digital asset as this may result in a cylic holding of digital assets. To prevent this,  we introduced a new subtype of token called 'composable,' which differs from the other type, named 'trait,' in terms of composability. This means that only composable digital assets can hold trait digital assets, and not the other way around. However, both digital asset subtypes can hold fungible assets. 

So in short, the composable can hold the trait, but not the other way around. Both types can hold fungible assets.

a composable can hold - or equip - a trait, means that this composable is now the owner of the trait. But trait is still indirectly owned by the owner of both the composable and the trait. This means that the owner of the composable can transfer - or manage - the composable and what's being owned by it.
Moreover, if a trait is equiped in a composable, it will "stick" to the composable and will wherever that composable is being transfered (`ungated transfer is off`). This is enforced unltill that trait is unequipped from the composable. And it is achieved by associating the necessary references in a resource that is stored under the digital asset itself upon creation. This ensures that composability logic is always executed when a token is transferred, preventing any transfers that could violate the internal state of the composability logic. But fungible assets can be allocated to either of these digital assets (composable, trait). 

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.

...

- `studio.move`
- `mint.move`
- `p2u.move`

## Testing (Optional)

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out)
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

...

A really good example is Metaplex's tools page for Solana programs
Although i'm not 100% sure about what each of these tools do, but they seem to support a range of Solana programs outside of their Metaplex NFT stack
we need to know ourselves if that's something we want to do
if we just want to focus on our NFT standard, then we also and just would need to know which platforms our users will need
but let's start from the basics, what platform support we'd need to build if we were to grow our cNFT standard into a Candy Machine V3 like product from Metaplex?

after we know what the specs are then we can discuss the roadmap for expanding it into smth larger like Metaplex's full stack:

Then I assume we'll know what to look include in AIP when we implement this part.

I always thought our contracts would serve as a standardized mechanism for composability, and that the "Metaplex-like" platform we will be building is something that will not be included to the AIP, meaning that technically competitors can also build their tool on top of our platform. 

So our contribution will be the composability contract that will hopefully be integrated within the framework, and we will be the best to leverage it as we're the pioneers.

On the other hand, building the tool first and then push the AIP will fill one of the forum's section where we're asked to test it; as far as I understood, this is not about unit testing, this is about  the community actually using it.

## Risks and Drawbacks
TODO 
 > - Express here the potential negative ramifications of taking on this proposal. What are the hazards?
idk, maybe if updating the uri is done wrongly, then it could result in a scam. but i think we can mitigate this by enforcing that the uri is generated on chain.

 > - Any backwards compatibility issues we should be aware of?
No, this standard will be build on top of existing standards and without making any changes to them.

 > - If there are issues, how can we mitigate or resolve them?
updating URI.
...

## Future Potential
TODO 
 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in in one year? In five years?

...
Countless advantages in various fields, such as:
- gaming: composable digital assets can be used to create a game where players can equip their characters with different traits and fungible assets. This will allow for more creativity and customization, enhancing the overall gaming experience. Imagine an avatar that can hold a sword, a shield, and a bag of gold coins. It can also have a pet, which can be soulbound owned by the avatar so it will be sticked to the avatar while transfering the avatar itself is possible.
- ticketing: composable digital assets can be used to create a ticketing system where users can purchase a bundle (composable digital asset) that includes tickets (trait digital assets) and cryptocurrencies to spend at the event (fungible assets). This will allow for a more streamlined and secure ticketing process.
- real estate: tokenizing real-world assets, such as real estate, will have advanced features, where one real-estate, a house per se, can be represented as a composable digital asset, and the rooms inside the house can be represented as trait digital assets. This will allow for more flexibility and customization, so one can think of selling one part of the house, a garage for example, while not selling the rest of the house. Transferring ownership can be limited and temporary as well (rent cases).
  
## Timeline

### Suggested implementation timeline
TODO
 > Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

...

The current implementation is already functional in terms of being an NFT standard that allows creators to create composable NFTs in a developer-friendly way. Based on the Token Asset standard, this implementation ___________
 
Building a no-code frontend would take another month.


### Suggested developer platform support timeline
TODO
 > Describe the plan to have SDK, API, CLI, Indexer support for this feature is applicable. 

...

### Suggested deployment timeline
TODO
 > Indicate a future release version as a *rough* estimate for when the community should expect to see this deployed on our three networks (e.g., release 1.7).
 > You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design review.
 >
 > - On devnet?
 > - On testnet?
 > - On mainnet?

...

-   	Indicate a future release version as a “rough” estimate for when the community should expect to see this deployed on our three networks (e.g. release 1.7)
-   	On devnet/testnet/mainnet?
It’s deployed on testnet already. Mainnet ETA is


## Security Considerations
TODO
> - Does this result in a change of security assumptions or our threat model?
- 
> - Any potential scams? What are the mitigation strategies?
- One potential security that I can think of, relies to the way the URI of a composable digital asset is updated. If this is done off chain, then this could open the door for a potential scam. To mitigate this, we can enforce that the URI link is generated on chain.

> - Any security implications/considerations?
- 
> - Any security design docs or auditing materials that can be shared?
- 

## Open Questions (Optional)
TODO 
> Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should

how to generate a uri onchain based a given order? 
