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

We believe creators should not worry about implementing the actual code to manage composability. The primary goal of this solution is to establish a standardized and secure approach to composability for digital assets, allowing them to hold other digital and fungible assets. This will address the following challenges:

- **Enhance the use of the digital/fungible assets standards:** Creators will be able to leverage the power of the new standards in a couple of clicks with straightforward steps. They will also have control over the customization of their composable digital assets (meaning they can equip them with trait digital assets or fungible assets like cryptocurrencies), allowing for more creativity setups and use cases.

- **Mitigate security risks:** The enforcement of composability logic will minimize the potential for security vulnerabilities, more precisely when managing transfer reference for the digital assets.

The scope of this solution encompasses a standardized set of protocols will be defined to ensure interoperability and compatibility between digital assets and also fungible assets.

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
- **more complicated to use:** Creators will continue to face the burden of manually implementing composability features, limiting their ability to focus on other relevant aspects. 

- **Elevated Security Risks:** The lack of standardization of composability logic will require creators to carfully handle references depending on their needs. Failing to do so could potentioally result in losing the ownership of the digital assets.

## Impact

The proposed change will allow creators to benefit from the real power of the digital assets standards. Digital assets support composability in essence, but the logic implementation for it is not standardized. It's like having a car without a steering wheel.

## Alternative solutions

Composability using `aptos_token.move`:

To maintain the integrity of the composability logic, digital assets must be categorized into distinct subtypes. This categorization facilitates the identification of digital assets that can be composed together. Adopting the `aptos_token.move` approach would result in the generation of another object within the AptosToken object, an undesirable outcome. 

Furthermore, while one can argue that `aptos_token.move` module may seem like a convenient no-code solution that can serve composability, it falls short in several crucial aspects. Firstly, relying on this module leads to unnecessary overhead, (as it generates all references), even those that are not required. Secondly, the URI for a composable digital asset should not be manually inputted by the creator. Instead, it should be dynamically generated by an on-chain image generator or a third-party service. This is essential because the URI of a composable digital asset is not static and evolves based on the trait digital assets it encompasses. For instance, if a composable digital asset incorporates a trait digital asset, its URI must be updated accordingly.

```Rust
// entry function from aptos_token.move to set uri:
public entry fun set_uri<T: key>(
        creator: &signer,
        token: Object<T>,
        uri: String,
    ) acquires AptosCollection, AptosToken {
        assert!(
            is_mutable_uri(token),
            error::permission_denied(EFIELD_NOT_MUTABLE),
        );
        let aptos_token = authorized_borrow(&token, creator);
        token::set_uri(option::borrow(&aptos_token.mutator_ref), uri);
    }  
```

## Specification

- **digital assets subtypes:** To prevent the formation of cyclic digital asset holdings, we introduce a distinction between two digital asset subtypes: `composable` and `trait`. Only composable assets can directly hold trait assets, ensuring a unidirectional flow of ownership. Both composable and trait assets can, however, hold fungible assets.

```Rust
    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    // Storage state for composables; aka, the atom/primary of the token
    struct Composable has key {
        traits: vector<Object<Trait>>
    }

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    // Storage state for traits
    struct Trait has key {
        index: u64, // index from the vector for easy lookup
        type: String
    }
```

In the composable and trait digital asset system, only the owner of both the composable and trait digital assets can perform equipping and unequipping. When a trait is equipped to a composable, ownership of the trait is effectively transferred to the composable object.

When the composable asset is transferred to another user, the trait asset that was equipped to it also gets transferred along with it. This is because the trait asset is now considered part of the composable asset so it remains sticky to the composable unless an unequip action executed. This ensures that the composable asset's new owner has full control over both the composable asset and the traits that are equipped to it.

Same mechanism goes for the fungible assets.

```Rust
fun equip_trait_internal(
    signer_ref: &signer,
    composable_object: Object<Composable>,
    trait_object: Object<Trait>
) acquires Composable, References {
    let composable_resource = borrow_global_mut<Composable>(object::object_address(&composable_object));
    let trait_references = borrow_global_mut<References>(object::object_address(&trait_object));
    // Add the object to the vector
    vector::push_back<Object<Trait>>(&mut composable_resource.traits, trait_object);
    // Assert ungated transfer enabled for the object token.
    assert!(object::ungated_transfer_allowed(trait_object) == true, errors::ungated_transfer_disabled());
    // Transfer
    object::transfer_to_object(signer_ref, trait_object, composable_object);
    // Disable ungated transfer for trait object
    object::disable_ungated_transfer(&trait_references.transfer_ref);
}

fun equip_fa_to_token<FA: key, Token: key>(
        signer_ref: &signer,
        fa: Object<FA>,
        token_obj: Object<Token>,
        amount: u64
) {
    // assert signer is the owner of the token object
    assert!(object::is_owner<Token>(token_obj, signer::address_of(signer_ref)), errors::not_owner());
    let token_obj_addr = object::object_address(&token_obj);
    // assert Token is either composable or trait
    assert!(
        type_info::type_of<Token>() == type_info::type_of<Composable>() || type_info::type_of<Token>() == type_info::type_of<Trait>(), 
        errors::type_not_recognized()
    );
    // transfer 
    primary_fungible_store::transfer(signer_ref, fa, token_obj_addr, amount);
}
```

To maintain composability logic, trait assets become inextricably linked to the composable asset they are equipped in, preventing their independent transfer unless unequipped. This linkage is achieved by associating references in a resource stored alongside the digital asset upon creation. This mechanism ensures that composability rules are enforced during asset transfers, preventing any inconsistencies or violations of the composability logic. While fungible assets can be allocated to either composable or trait assets, the distinction between composable and trait assets maintains the integrity of the composability system.

uri is updated when a trait of a fungible asset is equipped/unequipped to/from a composable digital asset. This is done by calling the `update_uri` function. 

```Rust
fun update_uri_internal(
    composable_object_address: address,
    new_uri: String
) acquires References {
    let references = borrow_global_mut<References>(composable_object_address);
    let mutator_reference = &references.mutator_ref;
    token::set_uri(mutator_reference, new_uri);
} 
```

## Reference Implementation

- [townespace/studio.move](https://github.com/TowneSquare/TowneSpace-contract/blob/dev/scripts/studio.move)
- [townespace/mint.move](https://github.com/TowneSquare/TowneSpace-contract/blob/dev/scripts/mint.move)

## Risks and Drawbacks

- Things can go wrong if updating the uri is done wrongly, then it could result in a scam. but i think we can mitigate this by enforcing that the uri is generated on chain.

- The proposed standard will be added on top of existing standards and without making any changes to them. This means that the proposed standard will not break any existing functionality.
...

## Future Potential

Enhancing the digital assets standards with composability can unlock a wide range of use cases across diverse industries:

- **Gaming:** Players can create unique characters by equipping them with various traits and items. This could include weapons, armor, pets, and even other characters. Composable digital assets make this possible by allowing developers to create a wide range of modular assets that can be combined in endless ways. This would lead to more creative and customizable gameplay experiences, keeping players engaged and excited.

- **Ticketing:** Composable digital assets can revolutionize ticketing systems by allowing organizers to offer bundled packages that include tickets, merchandise, and even cryptocurrencies for spending at the event. This would streamline the purchasing process and provide fans with a seamless experience. Additionally, composable digital assets could be used to create dynamic tickets that adjust prices based on real-time demand or offer exclusive perks to certain holders.

- **Real Estate:** Tokenizing real estate assets opens up a world of possibilities. Imagine owning a house that is represented as a composable digital asset. Each room in the house could be represented as a trait digital asset, allowing for fractional ownership. This means that you could sell or rent out individual rooms without having to sell the entire house. Additionally, composable digital assets could be used to create temporary ownership structures, such as short-term rentals or timeshare agreements.

These are just a few examples of the many ways that composable digital assets can be used to enhance various industries. As the proposal continues to develop, we can expect to see even more innovative and transformative applications emerge.
  
## Timeline

### Suggested implementation timelines

The core implementation is already functional and deployed on testnet. The next step is to get feedback from the community and iterate on the design. Once the design is finalized, we can begin the integration process.

Meanwhile, we're working on a UI to make it easier for creators to use the composability toolkit. This will be released early next year.

### Suggested developer platform support timeline
 > Describe the plan to have SDK, API, CLI, Indexer support for this feature is applicable. 

...

> Note: Our SDK is out of scope for this AIP.

### Suggested deployment timeline

supposing the AIP passes the gatekeeper’s design review.

...

- On devnet: by February 2024
- On testnet: by March 2024
- On mainnet: by April 2024


## Security Considerations
- One potential security, relies on the way the URI of a composable digital asset is updated. If this is done off-chain, then this could open the door for a potential scam. To mitigate this, we can enforce that the URI link is generated on chain.

## Open Questions (Optional)

best practices to generate a uri onchain based a given order? 
