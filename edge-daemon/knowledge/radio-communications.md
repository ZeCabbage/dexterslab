# Radio Communications

## Emergency Communications and HAM Radio Basics

When phones and internet fail, amateur (HAM) radio provides reliable long-distance communication independent of grid power and commercial infrastructure. Radio communication can be the difference between isolation and coordinated survival.

## Why HAM Radio Matters for Survival

- Works when cell towers are down
- Independent of internet infrastructure
- No monthly fees or subscriptions
- Can reach across town, across the country, or around the world depending on equipment and conditions
- Solar-powered portable setups can operate indefinitely off-grid

## Licensing

In the United States, you must obtain an FCC license to transmit on amateur radio frequencies. There are three license levels:

**Technician Class (entry level):**
- 35-question multiple choice exam
- Covers basic regulations, operating practices, and electronics theory
- Grants full privileges on all frequencies above 30 MHz (VHF and UHF)
- Study time: 1-3 weeks with online resources
- No Morse code requirement

**General Class:**
- Unlocks most HF (high frequency) bands for long-distance communication
- Additional 35-question exam on top of Technician

**Extra Class:**
- Full access to all amateur frequencies
- Most advanced exam

**In a true emergency where life is at risk, anyone may transmit on any frequency regardless of license status.** This is explicitly permitted by FCC rules.

## Key Emergency Frequencies

### VHF/UHF (Local/Regional — Line of Sight)
- **146.520 MHz**: National 2-meter FM simplex calling frequency. This is THE frequency to try first for making local contact without a repeater
- **446.000 MHz**: National 70-centimeter FM simplex calling frequency
- **156.800 MHz (Channel 16)**: Marine VHF distress and calling frequency
- **FRS Channel 1 (462.5625 MHz)**: Family Radio Service — no license required, limited power

### HF (Long-Distance)
- **14.300 MHz USB**: Intercontinental Assistance and Traffic Net
- **7.230 MHz LSB**: SATERN (Salvation Army Team Emergency Radio Network)

### Non-HAM Emergency
- **CB Channel 9 (27.065 MHz)**: Designated emergency channel for Citizens Band radio
- **CB Channel 19 (27.185 MHz)**: Trucker channel — often monitored on highways

## Simplex vs Repeater Communication

### Simplex
Direct radio-to-radio communication on a single frequency. No infrastructure required.
- Range limited by terrain and power — typically 2-15 miles for handheld radios
- Most reliable mode when infrastructure has failed
- Both radios must be on the same frequency
- Best with line-of-sight to the other station (elevation helps)

### Repeaters
Automated relay stations on hilltops or towers that receive your signal on one frequency and retransmit it on another from a high location.
- Greatly extends range (50+ miles possible through a single repeater)
- Requires repeater infrastructure to be operational (may fail in disasters)
- Requires knowing the repeater's input/output frequencies and any access tone (CTCSS/PL tone)
- Keep a printed list of local repeater frequencies in your go-bag

## DIY Antenna Building

A good antenna matters more than radio power. A weak radio with a great antenna outperforms a powerful radio with a poor antenna.

### Half-Wave Dipole Antenna
The simplest and most effective DIY antenna.

**Formula:** Total length in feet = 468 ÷ frequency in MHz

**Example for 2-meter band (146 MHz):**
468 ÷ 146 = 3.2 feet total (1.6 feet per side)

**Construction:**
1. Cut two equal lengths of wire to the calculated half-length
2. Connect both wires to opposite sides of coaxial cable at the center (one wire to center conductor, one to shield)
3. Hang horizontally between two supports (trees, poles) at least 10 feet high
4. The coax runs down to your radio

### Quarter-Wave Ground Plane Antenna
Good for a permanent base station.
1. Calculate quarter wavelength: 234 ÷ frequency in MHz = length in feet
2. One vertical element (radiator) of that length pointing up
3. Four horizontal elements (radials) of the same length pointing outward at 45 degrees down
4. Mount on SO-239 connector, feed with coax

### Tips
- Use an SWR meter or antenna analyzer to verify your antenna is tuned properly before transmitting at full power
- A poorly tuned antenna can damage your radio's transmitter
- Higher is better — every doubling of antenna height roughly doubles your range

## Morse Code Basics

Morse code (CW) gets messages through when voice signals are too weak. It uses less bandwidth and can be decoded by ear in noisy conditions.

### Essential Codes
- **SOS**: ··· --- ··· (dit-dit-dit dah-dah-dah dit-dit-dit) — universal distress signal
- **CQ**: -·-· --·- (calling any station)

### Learning Tips
- Learn by SOUND, not by reading dots and dashes
- Use the Farnsworth method: learn characters at full speed but with extra spacing between them
- Start with common letters: E, T, A, I, N, S
- Many free apps and websites available for practice while you still have internet

## Operating Protocols

1. **Listen before you transmit** — make sure the frequency is clear
2. **Identify yourself** with your call sign at the beginning and end of each transmission
3. **Keep transmissions brief** — say what you need to say and release the transmit button
4. **In emergencies**: say "MAYDAY MAYDAY MAYDAY" for life-threatening situations, "PAN-PAN PAN-PAN PAN-PAN" for urgent but not immediately life-threatening situations
5. **Speak slowly and clearly** — spell out critical information using the NATO phonetic alphabet (Alpha, Bravo, Charlie, Delta...)

## Portable Off-Grid Radio Setup

**Minimum go-kit:**
- Handheld VHF/UHF radio (Baofeng UV-5R as budget option, Yaesu FT-65R as reliable option) — 5 watts output
- Spare batteries or battery eliminator (AA pack)
- Small portable solar panel (10-20W) + charge controller for battery replenishment
- 50 feet of wire for improvised antenna
- Printed frequency list for local repeaters and emergency frequencies
- Pen and paper for logging contacts and messages

**Extended setup:**
- HF radio for long-distance (Xiegu G90, Icom IC-705)
- 100Ah LiFePO4 battery
- Folding solar panel (50-100W)
- End-fed wire antenna (covers multiple HF bands)

## Digital Modes (Advanced)

**Winlink**: Send and receive email over radio — no internet required. Uses dedicated Winlink relay nodes.

**JS8Call**: Keyboard-to-keyboard communication optimized for weak signals. Can relay messages through other stations automatically.

**APRS (Automatic Packet Reporting System)**: Transmits GPS position, weather data, and short messages. Useful for tracking and situational awareness.
