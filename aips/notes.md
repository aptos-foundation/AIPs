# Notes

1. Motivation needs to be changed; talk about the defined path introduced in the aip concisely (leave more to explain explicitly in the Rationale section).
2. Rationale needs to be changed;
   1. existing solutions:
   2. AIP-21
      1. why its not a SUFFICIENT solution for our TARGETED USE CASES.
   3. AIP-22
      1. why its not a SUFFICIENT solution for our TARGETED USE CASES.
      2. Mentioning of extensibility concerns.
      3. `property_map` from AIP-22 is not enough: it does not support `Object` data type, so we ultimately won't be able to objects inside, unlinke vectors.
         - why we need to store objects within the `property_map` anyways?
           - ease of data querying?
           - possible to mutate fields and perform operations?
      4. refer to hero.move and use flowchart diagram; => This is how composability would look lke using AIP-22...
   4. our solution:
      1. Mentioning the leveraged AIPs is missing (including them in the headline is not enough);
         1. why we're leveraging Object standard.
         2. how we're leveraging those the object standard.
         3. how we address extensibility by adding DA support in the Trait layer.
      2. talk about the defined path that we're proposing.
      3. how we're implementing the embedded composability.
      4. refer to hero.move and use flowchart diagram.
         1. Add an example section: a creator is creating a gaming NFT collection with composable traits.
         2. This AIP would allow for defining traits like this: cNFT - Knight, Trait - wooden sword, Object - power lotion (include the details & the figma image).
