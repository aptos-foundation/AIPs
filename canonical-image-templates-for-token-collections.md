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

In this document I propose a standard for Collection image templates on-chain. Alongside a Collection, a developer could store a `CollectionImageTemplate`, containing an SVG template. A view function `get_image` called on a token in that collection would return this template and values from a token's PropertyMap to return enough data to render an SVG for that token. Token images could dynamically update based on the data changing, unlocking a variety of usecases.

The current standard solution for images for tokens in a collection is to host them off-chain and point to them via uri. This is usually done with a CDN or via IPFS. This solution is brittle as the uri could break for many reasons: dns, cloud issues, lack of ipfs upkeep, etc. In an environment with easy perpetuity for logic (smart contracts), perpetuity for image hosting is still difficult. Additionally, storing thousands of uris on-chain takes a suprising amount of storage.

I aim to explain how a developer could store their template and property map values on each token, and how a wallet would render that token's image. I will also describe a variety of usecases.

#### Goals of this proposal:

1. Differentiate aptos by allowing developers to build an Token project that is 100% on-chain
2. Reduce non-aptos network calls for wallets
3. Unlock on-chain dynamic Token images (images that change based on underlying data)
4. Explore composite Tokens (Tokens built with other Tokens as components)

#### Potential metrics:

1. size of data on-chain stored for templates vs uris
2. reduction of network calls for dynamics Token images
3. uptick in Token developers that are interested in Tokens that don't a CDN or IPFS
4. % of templated projects with "rotted images" vs % of uri projects with rotted links

### Out of Scope

This proposal is NOT for hosting images or any kind of file storage on-chain. The goal is not to store raw data on the blockchain, but instead a single template that can be used repeatedly to represent many tokens.

This proposal also does NOT recommend removing the option for individual token URIs. This is still a better option for many use cases.

I do not go into detail about the client side code needed to render the images, but it would be helpful to wallet developers if a standard library was provided.

# High-level Overview

A struct would be added to Collection.move, CollectionImageTemplate.

```
struct CollectionImageTemplate {
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

When loading tokens owned by a user, after seeing an empty token URI field and checking to see that a `CollectionImageTemplate` exists for the token's collection, a wallet would call a function named something like `get_templated_image_data` to fetch the necessary template and PropertyMap to render the SVG.

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

![Normal Smiley](./images/normal_smiley.png)

```
 {
    face_color: "red",
    left_eye_size: "5",
    left_eye_color: "black",
    right_eye_size: "5",
    right_eye_color: "black"
 }
```

![Red Smiley](./images/red_smiley.png)

```
 {
    face_color: "#e097e6",
    left_eye_size: "4",
    left_eye_color: "#5a0c0c",
    right_eye_size: "9",
    right_eye_color: "#5a0c0c"
 }
```

![Pink Wacky Smiley](./images/pink_wacky_smiley.png)

With just these five variables, we've practically infinite combinations of generative Tokens:

There are 256<sup>3</sup> combinations for each color. If we cap the size of the eyes from 1-10, then we have 256<sup>3</sup> _ 256<sup>3</sup> _ 256<sup>3</sup> _ 10 _ 10 or 4.72e23 combinations! But for the sake of argument, let's say there are just 10k combinations. Let's compare the template implementation with a version of this implemented today:

It is currently standard practice to include property maps on your Tokens to help marketplaces index and display traits/rarities. So for this calculation I will not include that as additional data to store on-chain, as it generally already exists.

The example image template is 364 bytes. Let's assume some extra data requirements for storing the property map keys vector, vector/object information overhead and triple that value to 1Kb.

The standard developer would do the following: generate 10k random seeds offline, store all the images at a CDN or IPFS, then store 10000 image URIs on-chain for each token. an extremely efficient uri pattern might look something like this: hosting.site.io/smiley/00001.png. Each uri in this pattern is 32 bytes. To store 10,000 of these URIs, you need to store 10,000 \* 32 = 320 Kb! IPFS uris commonly include hashes rather than logical addresses, multiplying this number even higher. Some of these exceed 100 bytes, but let's consider that the upper bound. At 10,000 images, that's a full 1MB just to store all the URIs.

In this example, we're getting 1000x storage efficiency by using a template. That allows us to make the maximum complexity (data size) of the template high without surpassing current data storage usage.

On the marketplace side of things, to render 100 images a marketplace must make 100 GETs to a third party endpoint. With the template, as the marketplace already has the property maps, they simply need to fetch the template once and have now saved many magnitudes of network traffic!

But what if we wanted to make a more complex Token while still keeping each template simple?

Enter composite Tokens. Each template can also link to _other Tokens_ as part of its own image. A smiley could include a tophat collection as part of its template, and then the smiley is wearing a tophat!

By writing a format string that represents ANY token image, we merge both into the final populated template as follows:

- in the case of a uri, insert using an `<image>` tag
- in the case of a templated svg, insert an svg inline using `<svg>` tags

The formatting here needs some more thought.

```
<svg width="100" height="100" >
  <!-- Format string, library would parse into svg/image (as used directly in option 2) -->
  ${{composite_address: 0x4567..., height: 35, width: 35, x: 35, y: 10}}
  <circle cx="50" cy="50" r="30" stroke="black" stroke-width="2" fill="${face_color}"/>
  ...
</svg>
```

...

## Impact

One of the biggest barriers to entry in Tokenated Art is where to store the images. By removing that barrier, more first-time developers will choose Aptos as a place to launch their first NFT project.

For example, in a generative art NFT case, a developer can focus on defining their template in a creative way, use aptos random to get a seed, and launch an collection without ever deploying anything besides a contract. This could easily be done in a UI tool where an artist designs "layers" and how they respond to random input, then combines them as they see fit. They can then launch the collection all from a UI. There is no IPFS upkeep or payments to marketplaces for static hosting.

Dynamic Token images will unlock a myriad of usecases. The origin of this project is that I am an engineer at Mirage Protocol. I am building a web2 image server that takes in a token address (the token represents a position on our perpetual futures trading platform) and generates an image in response to the current status of the position. The idea is that you can just glance at a wallet and see "BTC Long 10x (+55%)" on the token. This way, you don't need to actually go to the frontend to see a high-level view. There are many issues with using a web2 server. Do wallets cache the images, and if so for how long? We also wouldn't want to get constant tps from a wallet in the background. We have to send the full image for each position each update, the networking costs are high.

If we could instead define a template, we could publish a nice background on-chain, with the data for "Margin" "Perpetual" "PnL" "Liquidation Price" etc on top. By including composites in this proposal, we could also show the image from the FungibleAsset metadata. Wallets could update all the images simply by refreshing the associated token account resources.

This idea could be extended for all DeFi instruments, but also far beyond that. Imagine getting an airplane ticket in your wallet. It could show you the gate and boarding time right in the wallet. A two day bonus xp pass to a video game that has a live countdown in your wallet. A basketball ticket that updates as a virtual "stub" with the final score and the MVP of the game.

Art living off-chain is not the final form of blockchains. There needs to be a solution beyond URIs.

## Alternative solutions

The main alternative outcome is relying fully on web2 image servers to fulfill this purpose. This works but as explained above, has issues with varying wallet implementations and heavy burdens on developers. New developers trying to step into tokenated art projects are going to continute to be intimidated by hosting concerns. Many projects will continue to stop supporting their links and have only a dead uri remaining.

As to alternatives to SVG, SVG is likely the best format to template as it is human readable therefore developer friendly. The main alternative here would be writing a custom standard, but that would both take much longer to propose and also be a larger burden on developers trying to use the product, as well as a much larger burden to maintain an external library. The main upside would be possible data size reductions on-chain.

## Specification and Implementation Details

A struct would be added to collection.move, CollectionImageTemplate.

```
struct CollectionImageTemplate {
    svg_template: vector<u8>, // bytes representing svg template
    property_map_key: <vector<string>>
}
```

This would be created and stored with the Collection using the `ConstructorRef` generated when creating the Collection.

The following functions would be added to collection.move:

```
// adds a collection template (used after collection creation)
public fun create_image_template(constructor_ref: &ConstructorRef, template: vector<u8>, keys: vector<string>)

// updates a collection template
public fun set_image_template(mutator_ref: &MutatorRef, template: vector<u8>) acquires CollectionImageTemplate

// updates a collection template keys
public fun set_image_template(mutator_ref: &MutatorRef, keys: vector<string>) acquires CollectionImageTemplate

// returns whether the collection image template object exists or not (maybe if the image vector length > 0)
public fun has_image_template<T: key>(collection: Object<T>): bool acquires CollectionImageTemplate

// returns image template, keys
public fun get_image_template<T: key>(collection: Object<T>): (vector<u8>, vector<string>) acquires CollectionImageTemplate
```

When loading tokens owned by a user, after seeing an empty token URI field and checking to see that a `CollectionImageTemplate` exists for the token's collection using `has_image_template`, a wallet would call `get_image_template` to fetch the necessary template and keys, then `read` on the token's PropertyMap using the keys to fetch the data, before populating it client-side and rendering the SVG.

It may be helpful to also include a function that returns all the necessary data from the PropertyMap at once to make it standardized. This could be added to `token.move` and be called something like `get_templated_image_property_data`. No arguments will need to be provided as the token can fetch the collection address from itself, then get the template keys from the collection.

The library to render the SVG for wallets and marketplaces will be relatively simple, mostly just business logic for the correct way to replace the format strings. SVG is extremely well implemented in browsers and native engines and should not run into any issues on its own.

## Reference Implementation

Mostly included above but happy to dive into more details here as questions come out. If moving forward would personally be most interested in implementing the npm svg building library.

## Testing (Optional)

To test, overall ensure rendering works end to end by using the svg building library and saving images using a simple node script. This can be iterated on until it works. Once implementation works, test limits of template size. Compare on-chain data read/write patterns/volume and wallet/frontend network traffic vs traditional UI method.

...

## Risks and Drawbacks

The biggest risks are vulnerabilities in wallets if arbitrary bytes in an on-chain field are expected to be SVG template data and what could happen if it wasn't. This needs to be explored further. With proper data sanitation this should be an avoidable issue. The library to render the SVGs should be carefully audited/reviewed.

I can also foresee a risk of devs using the template to instead create 1 of 1 collections and storing an entire untemplated svg directly on-chain. With higher deployment costs, devs will be less likely to create 1of1s, or at least they will do so more intentionally.

I do not see an issue with backward compatibility on the contract side. Token and Collection URIs are not used on-chain and the lack of them in some projects would not cause issue. Wallets however would be required to update to support this standard or risk having Tokens without images. Wallets can be helped by making sure the library launches well before the proposal goes live on mainnet.

Composite Tokens are powerful but could be expensive networking wise. A solution would be some kind of "composite budget" within a template, eg 8 total references (calls to other tokens) with up to 2 recursions (nested calls).

## Security Considerations

Went into above.

...

## Future Potential

This proposal is not meant to represent the final evolution of image/media representation of tokens. But something needs to be done to push the industry forward beyond storing a uri to an off-chain machine. By storing templates, Aptos could show the greater crypto community that its possible to store more than just code on a blockchain, while still pushing efficiency forward, and bring a renewed focus on decentralization and permanence for token creators.

This proposal could bring a wave of new developers to aptos curious about its 100% onchain NFT collections. An MS paint like UI tool could be created to launch token collections with randomness with no-code.

Projects using Aptos Tokens in functional projects like DeFi or ticketing could be intentional with designing their collection's images to be updating in real time based on the underlying data. This feature is differentiating in the blockchain space.

Hopefully, people smarter than me will consider more on how "templates" and "blueprints" can be stored on-chain to create complex composite objects. The more things we can put on-chain, the less we have to rely on centralized entities.

## Timeline

### Suggested implementation timeline

Estimating in software is hard but I do not think adding the struct with the vectors and the associated CRUD would take much time. Choosing where to put it would take more time. Agreeing on the template max size would take some time, but ideally it would be possible to design the core code in such a way that it could be increased over time (as to start small).

My estimate is the code itself could be done by one developer in a few weeks, if everything was agreed upon.

### Suggested developer platform support timeline

Writing the template library will mostly just be a task of calling the right functions from collection.move and property_map.move, then finding and replacing template strings as needed. Once the template is populated, the image should function like a regular SVG, so no code to write SVG rendering will be necessary. The code should not be complicated here either, but the security concerns regarding the arbitrary bytes are not to be ignored and will consider some time.

There is also of course whatever general devrel pipeline is needed in regards to getting wallet / marketplace devs to update to use the library (or new version of aptos's library).

Documentation etc needed

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
