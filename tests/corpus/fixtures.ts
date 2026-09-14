/**
 * Fixed strings the corpus cannot derive purely: bytewords of specific byte
 * sequences (computed once from the frozen baseline) and the 1024-byte
 * "Wolf" message from the Rust `ur` crate's tests (xoshiro seeded with
 * sha256("Wolf"), the first 256 bytes are the 256-byte message).
 */
export const STRINGS = {
  badCborBreak: "zmzmaeaeae",
  badCborTruncated: "lfadfhjetpnb",
  nonCanonical: "csahqdpdkbdt",
  arr123: "lsadaoaxjygonesw",
  std5: "acid also apex aqua arch fuel bald nail work",
  uri5: "acid-also-apex-aqua-arch-fuel-bald-nail-work",
} as const;
/**
 * Multipart part strings for the decoder-acceptance rows (computed once
 * from the working tree, then frozen):
 * `44 01 02 03 04` (a 4-byte CBOR byte string, 5 bytes) at `maxFragmentLength`
 * 4 gives two 3-byte fragments with one padding byte; `PADDED_2` is part 2
 * with that byte set to `0xff` (`data = 03 04 ff`) and re-checksummed at the
 * bytewords layer.
 */
export const PARTS = {
  /** Part 1 of 2. */
  P1: "ur:bytes/1-2/lpadaoahcyztdtdpfefxfyadaokbtpcsrd",
  /** Part 2 of 2 (`data = 03 04 00`). */
  P2: "ur:bytes/2-2/lpaoaoahcyztdtdpfefxaxaaaewswdssiy",
  /** Part 2 of 2 whose padding byte is `0xff`. */
  PADDED_2: "ur:bytes/2-2/lpaoaoahcyztdtdpfefxaxaazmsavsdnwm",
  /** Part 1 of 2 relabelled `2-2` in the URL; the reference ignores the label (it parses it as two `u16`s and reads the CBOR). */
  P1_AS_2_2: "ur:bytes/2-2/lpadaoahcyztdtdpfefxfyadaokbtpcsrd",
  /** Part 1 of 2 with a `+` in the header, which `u16::from_str` accepts. */
  PLUS_HEADER: "ur:bytes/+1-2/lpadaoahcyztdtdpfefxfyadaokbtpcsrd",
  /** A part whose URL header and CBOR both say `70000-70000`, beyond `u16`. */
  BIG_HEADER: "ur:bytes/70000-70000/lpcyaeadbyjocyaeadbyjoahcyztdtdpfefxfyadaojsrtkoze",
  /** URL `1-1`, CBOR `seqNum` 2^40. */
  U32_FIELD: "ur:bytes/1-1/lpcwaeaeadaeaeaeaeaeadahcyflbdnlwkfeadaoaxaaahmddevssa",
  /** URL `0-1`, CBOR `seqNum` 0. */
  SEQ0_FIELD: "ur:bytes/0-1/lpaeadahcyflbdnlwkfeadaoaxaaahcntorhdl",
  /** A one-part message `44 01 02 03 04`. */
  SINGLE: "ur:bytes/1-1/lpadadahcyztdtdpfefefyadaoaxaabdgspkge",
  /** A one-part message whose bytes (`ff 00 00 00`) are not valid CBOR. */
  BAD_CBOR_MESSAGE: "ur:bytes/1-1/lpadadadcyzmaeaeaefpzmrddeplhg",
  /** A one-part message `62 61 ff`: a CBOR text that is not valid UTF-8. */
  INVALID_UTF8_MESSAGE: "ur:test/1-1/lpadadaxcyvwynjkemfxidhszmzoztgmdw",
  /** A one-part message `64 ef bb bf 61`: a CBOR text starting with U+FEFF. */
  BOM_MESSAGE: "ur:test/1-1/lpadadahcyqzjllprpfeiewsrkrshsgwttvlca",
} as const;
/**
 * Part strings for the step-by-step decoder rows. Three-fragment messages
 * `48 01 02 03 04 05 06 07 08` (a CBOR byte string of 8 bytes) at
 * `maxFragmentLength` 3; `bytes/1-1` parts carry `44 01 02 03 04`.
 */
export const SCAN = {
  /** A mixed part arrives before the fragments it needs; a duplicate simple part does not drain the queue. */
  QUEUE_NOT_DRAINED: [
    "ur:bytes/1-3/lpadaxascytapyvocafxfdadaowdprhsbg",
    "ur:bytes/23-3/lpchaxascytapyvocafxahaxbttehhfdmn",
    "ur:bytes/4-3/lpaaaxascytapyvocafxgrahatiegynlti",
    "ur:bytes/1-3/lpadaxascytapyvocafxfdadaowdprhsbg",
    "ur:bytes/17-3/lpbyaxascytapyvocafxglambkotrywypt",
    "ur:bytes/3-3/lpaxaxascytapyvocafxamataysgaobyur",
  ],
  /** The part's CBOR `checksum` field is 0; the bytewords checksum is valid. */
  CHECKSUM_WRONG: ["ur:bytes/1-1/lpadadahaefefyadaoaxaaroyncspe"],
  /** A simple part for fragment 1 arrives after fragment 1 was derived from a mixed part, carrying different bytes. */
  OVERWRITE_DERIVED: [
    "ur:bytes/1-3/lpadaxascyvagwlsgyfxfdadaoctcwsbjo",
    "ur:bytes/14-3/lpbaaxascyvagwlsgyfxgrahatkgtkuyte",
    "ur:bytes/2-3/lpaoaxascyvagwlsgyfxaxzmahaebycpeh",
    "ur:bytes/3-3/lpaxaxascyvagwlsgyfxamatayfhpyrkry",
  ],
  /** Two 3-byte fragments for a 2-byte message: a whole fragment lies past `messageLen`. */
  EXTRA_FRAGMENT: [
    "ur:bytes/1-2/lpadaoaocyenurytcsfxfpataeltlbamut",
    "ur:bytes/2-2/lpaoaoaocyenurytcsfxaeaeaetoyaonca",
  ],
  /** `messageLen` 10 with one 5-byte fragment. */
  LEN_EXCEEDS: ["ur:bytes/1-1/lpadadbkcyztdtdpfefefyadaoaxaakktpecfr"],
  /** Parts whose CBOR is not dCBOR: a `18` head on `seqNum`, a `1b` head on the checksum, a `98` array head, a `58` bytes head, a trailing byte. */
  NON_CANONICAL: [
    "ur:bytes/1-1/lpcsadadahcyztdtdpfefefyadaoaxaavtjetkvo",
    "ur:bytes/1-1/lpadadahcwaeaeaeaeztdtdpfefefyadaoaxaasrghehpa",
    "ur:bytes/1-1/mkahadadahcyztdtdpfefefyadaoaxaarlimhyiy",
    "ur:bytes/1-1/lpadadahcyztdtdpfehdahfyadaoaxaagtfejlgd",
    "ur:bytes/1-1/lpadadahcyztdtdpfefefyadaoaxaaaefyaebdpt",
  ],
  /** Parts the part codec rejects: an indefinite array, indefinite bytes, four elements, text data. */
  MALFORMED_PART: [
    "ur:bytes/1-1/neadadahcyztdtdpfefefyadaoaxaazmkgmthnmt",
    "ur:bytes/1-1/lpadadahcyztdtdpfehefefyadaoaxaazmtnvsiszo",
    "ur:bytes/1-1/lradadahcyztdtdpfebefzjets",
    "ur:bytes/1-1/lpadadahcyztdtdpfeihfyadaoaxaabnvtpeke",
  ],
  /** A `seqNum` 0 part of a two-fragment message, then the two real parts. */
  SEQ0_THEN_GOOD: [
    "ur:bytes/0-2/lpaeaoahcyztdtdpfefxfyadaovwkightl",
    "ur:bytes/1-2/lpadaoahcyztdtdpfefxfyadaokbtpcsrd",
    "ur:bytes/2-2/lpaoaoahcyztdtdpfefxaxaaaewswdssiy",
  ],
} as const;
/** Part CBOR (hex) for the fountain-decoder rows over the three-fragment message. */
export const FOUNTAIN_SCAN = {
  /** Fragment 1 is derived from a mixed part, then arrives as a simple part with `ff` in it. */
  OVERWRITE_DERIVED: [
    "850103091ad9abe21d43480102",
    "850403091ad9abe21d434b0507",
    "850203091ad9abe21d4303ff05",
    "850303091ad9abe21d43060708",
  ],
  /** Two mixed parts over the same two fragments in opposite index order are both new. */
  REVERSED_DUPLICATE: [
    "850c03091ad9abe21d434b0507",
    "850403091ad9abe21d434b0507",
    "850103091ad9abe21d43480102",
  ],
} as const;
/** `crc32([1, 2, 3, 4, 5])`, the checksum the hand-built fountain parts carry. */
export const CRC_12345 = 1191942644;
/** Raw part CBOR for the part-codec rows (hex). */
export const PART_CBOR = {
  /** `[1, 1, 5, CRC_12345, h'0102030405']`, the canonical encoding. */
  CANONICAL: "850101051a470b99f4450102030405",
} as const;
/** Raw part CBOR (hex) exercising every branch of the reference's minicbor reader. */
export const PART_CBOR_ROWS: readonly { hex: string; note: string }[] = [
  { hex: PART_CBOR.CANONICAL, note: "canonical" },
  { hex: "850001051a470b99f4450102030405", note: "seqNum-0" },
  { hex: "85180101031a0000000043010203", note: "non-minimal-heads" },
  { hex: "850101031a0000000043010203ff", note: "trailing-byte" },
  { hex: "850101051afc292d455f454401020304ff", note: "indefinite-bytes" },
  { hex: "850101051afc292d45654401020304", note: "text-data" },
  { hex: "853805", note: "negative-head-then-end" },
  { hex: "853805ff", note: "negative-head-i16" },
  { hex: "85380500", note: "negative-head-i8" },
  { hex: "9c", note: "array-reserved-info" },
  { hex: "850101051a000000005c", note: "bytes-reserved-info" },
  { hex: "", note: "empty" },
  { hex: "85c101", note: "tag-in-u32" },
  { hex: "85f90000", note: "f16-in-u32" },
  { hex: "a0", note: "map" },
  { hex: "851b0000000100000000", note: "u64-overflow" },
  { hex: "9f", note: "indefinite-array" },
  { hex: "8401010101", note: "array-of-4" },
  { hex: "8520", note: "negative-field" },
  { hex: "850101031a000000005b0020000000000000", note: "bytes-length-2^53" },
];
/**
 * Generated part-CBOR sequences (hex) for the fountain decoder: shuffled,
 * dropped and repeated parts of small messages, including mixed parts that
 * arrive before their fragments. Each was replayed through the reference and
 * the port step by step.
 */
export const FOUNTAIN_SEQUENCES: readonly { name: string; parts: readonly string[] }[] = [
  {
    name: "fuzz1",
    parts: [
      "850a02021a79770c7a44015fb86a",
      "850302021a79770c7a4140",
      "850202021a79770c7a4132",
      "850006021a79770c7a4140",
      "850502021a79770c7a4140",
      "850702021a79770c7a4179",
      "850a02021a79770c7a4140",
      "850c02021a79770c7a416d",
      "850b02021a79770c7a4172",
      "850202021a79770c7a4158",
    ],
  },
  {
    name: "fuzz191",
    parts: [
      "850001011a8707c9a243b70000",
      "850501011a8707c9a243b70000",
      "850301011a8707c9a243a02b26",
      "850401011a8707c9a243dab39b",
      "850001011a8707c9a243b70000",
      "850101011a8707c9a243b70000",
      "850401011a8707c9a243b70000",
      "850501011a8707c9a243b70000",
      "850601011a8707c9a243b70000",
      "850501011a8707c9a243b70000",
      "850a01011a8707c9a243b70000",
    ],
  },
  {
    name: "fuzz385",
    parts: [
      "850103061a846f084642e38e",
      "850a03061a846f0846423aa8",
      "850903061a846f084642ce63",
      "850103061a846f084642e38e",
      "850b03061a846f0846426bf4",
      "850d03061a846f084642ce63",
      "850503061a846f084642bcd0",
      "850d03061a846f084642ce63",
      "850c04061a846f0846422189",
      "850603061a846f084642965d",
    ],
  },
  {
    name: "fuzz582",
    parts: [
      "850203031a914f032a41b5",
      "850203031a914f032a41b5",
      "850d03031a914f032a4171",
      "850b03031a914f032a41b5",
      "850003031a914f032a4154",
      "850803031a914f032a41b5",
    ],
  },
  {
    name: "fuzz797",
    parts: [
      "850501091a8196afab427600",
      "850105091a8196afab42513c",
      "850805091a8196afab42c30a",
      "850605091a8196afab42adff",
      "850105091a8196afab42c30a",
      "850205091a8196afab42574d",
      "850205091a8196afab42ea97",
      "850e05091a8196afab42837d",
      "850505091a8196afab427600",
      "850e05091a8196afab422503",
      "850105091a8196afab42c30a",
      "850005091a8196afab42c30a",
    ],
  },
  {
    name: "fuzz999",
    parts: [
      "850003091a8f73ecfe43c86f3a",
      "850d03091a8f73ecfe43584549",
      "850403091a8f73ecfe43584549",
      "850503091a8f73ecfe43c86f3a",
      "850403091a8f73ecfe43584549",
      "850603091a8f73ecfe4301d530",
      "850103091a8f73ecfe43c86f3a",
    ],
  },
  {
    name: "fuzz1181",
    parts: [
      "850603031ae2af40a6413b",
      "850c03031ae2af40a641aa",
      "850b03031ae2af40a6416b",
      "850b03031ae2af40a64106",
      "850003031ae2af40a6417b",
      "850103031ae2af40a6417b",
      "850b03031ae2af40a64106",
      "850603031ae2af40a6417b",
      "850a03031ae2af40a641aa",
      "850703031ae2af40a6417d",
    ],
  },
  {
    name: "fuzz1378",
    parts: ["850104071ac3bc90974250e7", "850004071ac3bc90974250e7"],
  },
  {
    name: "fuzz1577",
    parts: [
      "8505050a1a8349e7b342ed5b",
      "8505050a1a8349e7b342ed5b",
      "850f050a1a8349e7b342a079",
      "850f050a1a8349e7b342a079",
      "8502050a1a8349e7b342a079",
      "8502050a1a8349e7b342a079",
      "8507050a1a8349e7b342ed5b",
      "8507050a1a8349e7b342ed5b",
      "850b050a1a8349e7b342ed5b",
      "8500050a1a8349e7b342ffeb",
      "8501050a1a8349e7b342ffeb",
    ],
  },
  {
    name: "fuzz1742",
    parts: [
      "8505050b1a56b1d731421700",
      "8504050b1a56b1d7314200f2",
      "8504050b1a56b1d7314200f2",
      "8500050b1a56b1d731424654",
      "8503050b1a56b1d7314254ea",
      "850d050b1a56b1d731421fa7",
      "8504050b1a56b1d7314200f2",
    ],
  },
  {
    name: "fuzz1925",
    parts: [
      "850c04041a59adca284132",
      "850a04041a59adca2841ee",
      "850604041a59adca284177",
      "850704041a59adca284177",
      "850b04041a59adca284169",
      "850204041a59adca284160",
    ],
  },
  {
    name: "fuzz2130",
    parts: [
      "850a04081acc3572f642c4eb",
      "850e04081acc3572f642502f",
      "850a04081acc3572f642c4eb",
      "850404081acc3572f6427f2f",
      "850a04081acc3572f642c4eb",
      "850e04081acc3572f642502f",
      "850904081acc3572f64245e4",
      "850904081acc3572f64245e4",
      "850104081acc3572f64245e4",
      "850a04081acc3572f6421b2d",
      "850704081acc3572f642c4eb",
      "850a04081acc3572f642c4eb",
    ],
  },
  {
    name: "fuzz2344",
    parts: [
      "8508050f1aa1b04dfe436e6954",
      "8501050f1aa1b04dfe43e98032",
      "8506050f1aa1b04dfe43eba874",
      "850c050f1aa1b04dfe43eba874",
      "8504050f1aa1b04dfe4387e966",
      "850d050f1aa1b04dfe43ce71f6",
      "8507050f1aa1b04dfe43e98032",
      "850d050f1aa1b04dfe43e74e8a",
    ],
  },
  {
    name: "fuzz2554",
    parts: [
      "850202021a132a940b4103",
      "850c02001a132a940b41c0",
      "850002021a132a940b41c0",
      "850102021a132a940b41c0",
      "850802021a132a940b41c3",
      "850102021a132a940b41c0",
      "850302021a132a940b41c3",
      "850002021a132a940b41c0",
      "850502021a132a940b4103",
    ],
  },
  {
    name: "fuzz2751",
    parts: [
      "850b040b1a5f03cedc43a0e400",
      "8508040b1a5f03cedc43cd3ee8",
      "8500040b1a5f03cedc43c70b69",
      "8505040b1a5f03cedc436ddae8",
      "850c040b1a5f03cedc43a0e400",
      "850c040b1a5f03cedc43a0e400",
      "850d040b1a5f03cedc43aad181",
    ],
  },
  {
    name: "fuzz2946",
    parts: ["850201011a97f604ea438c0000", "850901011a97f604ea438c0000"],
  },
  {
    name: "fuzz3141",
    parts: [
      "850704071a7d9b12324205a1",
      "850b04071a7d9b12324205a1",
      "850a04001a7d9b12324205a1",
      "850b04001a7d9b12324205a1",
      "850304071a7d9b1232423644",
    ],
  },
  {
    name: "fuzz3339",
    parts: [
      "850b02031ac699689442f900",
      "850602031ac699689442d11e",
      "850102031ac699689442d11e",
      "850b02031ac699689442daac",
      "850702031ac699689442f900",
      "850c02031ac699689442d11e",
      "850702031ac699689442f900",
      "850102031ac699689442d11e",
      "850b02031ac699689442f900",
      "850402031ac6996894429408",
      "850702031ac699689442f900",
    ],
  },
  {
    name: "fuzz3541",
    parts: [
      "850705051a0d497cc04109",
      "850205051a0d497cc04109",
      "850205051a0d497cc04109",
      "850205051a0d497cc04109",
      "850a05051a0d497cc041fc",
      "850b05051a0d497cc0411d",
      "850205051a0d497cc04109",
      "850d05051a0d497cc04109",
      "850b05051a0d497cc0411d",
      "850905051a0d497cc04106",
      "850905051a0d497cc0411d",
      "850b05051a0d497cc0411d",
      "850705051a0d497cc04109",
      "850b05051a0d497cc0411d",
    ],
  },
  {
    name: "fuzz3761",
    parts: [
      "850c03031a238d33d14165",
      "850c03031a238d33d14165",
      "850c03031a238d33d14165",
      "850803031a238d33d14115",
      "850d03031a238d33d14160",
      "850503031a238d33d1414e",
      "850803031a238d33d14165",
      "850d03031a238d33d14160",
    ],
  },
];
export const WOLF_1024_HEX =
  "916ec65cf77cadf55cd7f9cda1a1030026ddd42e905b77adc36e4f2d3ccba44f7f04f2de44f42d84c374a0e149136f25b01852545961d55f7f7a8cde6d0e2ec43f3b2dcb644a2209e8c9e34af5c4747984a5e873c9cf5f965e25ee29039fdf8ca74f1c769fc07eb7ebaec46e0695aea6cbd60b3ec4bbff1b9ffe8a9e7240129377b9d3711ed38d412fbb4442256f1e6f595e0fc57fed451fb0a0101fb76b1fb1e1b88cfdfdaa946294a47de8fff173f021c0e6f65b05c0a494e50791270a0050a73ae69b6725505a2ec8a5791457c9876dd34aadd192a53aa0dc66b556c0c215c7ceb8248b717c22951e65305b56a3706e3e86eb01c803bbf915d80edcd64d4d41977fa6f78dc07eecd072aae5bc8a852397e06034dba6a0b570797c3a89b16673c94838d884923b8186ee2db5c98407cab15e13678d072b43e406ad49477c2e45e85e52ca82a94f6df7bbbe7afbed3a3a830029f29090f25217e48d1f42993a640a67916aa7480177354cc7440215ae41e4d02eae9a191233a6d4922a792c1b7244aa879fefdb4628dc8b0923568869a983b8c661ffab9b2ed2c149e38d41fba090b94155adbed32f8b18142ff0d7de4eeef2b04adf26f2456b46775c6c20b37602df7da179e2332feba8329bbb8d727a138b4ba7a503215eda2ef1e953d89383a382c11d3f2cad37a4ee59a91236a3e56dcf89f6ac81dd4159989c317bd649d9cbc617f73fe10033bd288c60977481a09b343d3f676070e67da757b86de27bfca74392bac2996f7822a7d8f71a489ec6180390089ea80a8fcd6526413ec6c9a339115f111d78ef21d456660aa85f790910ffa2dc58d6a5b93705caef1091474938bd312427021ad1eeafbd19e0d916ddb111fabd8dcab5ad6a6ec3a9c6973809580cb2c164e26686b5b98cfb017a337968c7daaa14ae5152a067277b1b3902677d979f8e39cc2aafb3bc06fcf69160a853e6869dcc09a11b5009f91e6b89e5b927ab1527a735660faa6012b420dd926d940d742be6a64fb01cdc0cff9faa323f02ba41436871a0eab851e7f5782d10fbefde2a7e9ae9dc1e5c2c48f74f6c824ce9ef3c89f68800d44587bedc4ab417cfb3e7447d90e1e417e6e05d30e87239d3a5d1d45993d4461e60a0192831640aa32dedde185a371ded2ae15f8a93dba8809482ce49225daadfbb0fec629e23880789bdf9ed73be57fa84d555134630e8d0f7df48349f29869a477c13ccca9cd555ac42ad7f568416c3d61959d0ed568b2b81c7771e9088ad7fd55fd4386bafbf5a528c30f107139249357368ffa980de2c76ddd9ce4191376be0e6b5170010067e2e75ebe2d2904aeb1f89d5dc98cd4a6f2faaa8be6d03354c990fd895a97feb54668473e9d942bb99e196d897e8f1b01625cf48a7b78d249bb4985c065aa8cd1402ed2ba1b6f908f63dcd84b66425df";
