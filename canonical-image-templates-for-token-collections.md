---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Canonical Image Templates for Token Collections
author: Saul Dope (saul@mirage.money)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: <Standard (Core, Networking, Interface, Application, Framework) | Informational | Process>
created: <mm/dd/yyyy>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Canonical Image Templates for Token Collections

## Summary

In this document I propose a standard for TokenCollection image templates on-chain. Alongside a TokenCollection, a developer could store a `TokenCollectionImageTemplate`, containing an SVG template. A view function `get_image` called on a token in that collection would return this template and values from a token's PropertyMap to return enough data to render an SVG for that token. Token images could dynamically update based on the data changing, unlocking a variety of usecases.

The current standard solution for images for tokens in a collection is to host them off-chain and point to them via uri. This is usually done with a CDN or via IPFS. This solution is brittle as the uri could break for many reasons: dns, cloud issues, lack of ipfs upkeep, etc. In an environment with easy perpetuity for logic (smart contracts), perpetuity for image hosting is still difficult. Additionally, storing thousands of uris on-chain takes a suprising amount of storage.

I aim to explain how a developer could store their template and property map values on each token, and how a wallet would render that token's image. I will also describe a variety of usecases.

#### Goals of this proposal:

1. Differentiate aptos by allowing developers to build an NFT project that is 100% on-chain
2. Reduce non-aptos network calls for wallets
3. Unlock on-chain dynamic NFTs (images that change based on underlying data)
4. Explore composite NFTs (NFTs built with other NFTs as components)

#### Potential metrics:

1. size of data on-chain stored for templates vs uris
2. reduction of network calls for dynamics NFTs
3. uptick in NFT developers that are interested in NFTs that don't a CDN or IPFS
4. % of templated projects with "rotted images" vs % of uri projects with rotted links

### Out of Scope

This proposal is NOT for hosting images or any kind of file storage on-chain. The goal is not to store raw data on the blockchain, but instead a single template that can be used repeatedly to represent many tokens.

This proposal also does NOT recommend removing the option for individual token URIs. This is still a better option for many use cases.

I do not go into detail about the client side code needed to render the images, but it would be helpful to wallet developers if a standard library was provided.

# High-level Overview

A struct would be added to TokenCollection.move, TokenCollectionImageTemplate.

```
struct TokenCollectionImageTemplate {
    svg_template: vector<u8>, // bytes representing svg template
    property_map_key: <vector<string>>
}
```

The SVG template in raw form would look something like this, with piped in values stored in `${}`:

```
// An example svg_template of a smiley
<svg width="100" height="100" >
  <circle cx="50" cy="50" r="30" stroke="black" stroke-width="2" fill="${face_color}"/>
  <circle cx="40" cy="40" r="${left_eye_size}" fill="${left_eye_color}"/>
  <circle cx="60" cy="40" r="${right_eye_size}" fill="${right_eye_color}"/>
  <path d="M 40 60 Q 50 70, 60 60" stroke="black" stroke-width="2" fill="transparent"/>
</svg>
```

```
// An example property_map_key for the properties of a smiley face
[face_color, left_eye_size, left_eye_color, right_eye_size, right_eye_color]
```

When loading tokens owned by a user, after seeing an empty token URI field and checking to see that a `TokenCollectionImageTemplate` exists for the token's collection, a wallet would call a function named something like `get_templated_image_data` to fetch the necessary template and PropertyMap to render the SVG.

Here are some example return values in our smiley example:

```
 {
    face_color: "yellow",
    left_eye_size: "5",
    left_eye_color: "black",
    right_eye_size: "5",
    right_eye_color: "black"
 }
```

![standard_smiley](/images/normal_smiley.svg)

> Define the strawman solution with enough details to make it clear why this is the preferred solution.
> Please write a 2-3 paragraph high-level overview here and defer writing a more detailed description in [the specification section](#specification-and-implementation-details).

...

## Impact

> Which audiences are impacted by this change? What type of action does the audience need to take?
> What might occur if we do not accept this proposal?

...

## Alternative solutions

> Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

...

## Specification and Implementation Details

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

> Indicate a future release version as a _rough_ estimate for when the community should expect to see this deployed on our three networks (e.g., release 1.7).
> You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design review.
>
> - On devnet?
> - On testnet?
> - On mainnet?

...

## Open Questions (Optional)

> Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should

...
