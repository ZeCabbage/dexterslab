# Power Generation

## Off-Grid Electricity for Survival and Self-Sufficiency

Generating your own electricity enables lighting, communications, water pumping, food preservation, and medical equipment operation. Plan your power system by understanding your energy needs first, then selecting appropriate generation and storage equipment.

## Energy Audit — Calculate Your Needs First

Before buying or building any power equipment, calculate your daily energy consumption.

**How to calculate:**
1. List every electrical device you plan to power
2. Find its wattage (printed on the device or in manual)
3. Estimate hours of daily use
4. Multiply: watts × hours = watt-hours per day (Wh/day)
5. Add all devices together for total daily consumption
6. Add 25-30% buffer for system losses (inverter inefficiency, wire losses, cloudy days)

**Example daily loads:**
- LED lights (10W × 5 hours) = 50 Wh
- Radio communications (20W × 2 hours) = 40 Wh
- Phone charging (10W × 3 hours) = 30 Wh
- Water pump (100W × 1 hour) = 100 Wh
- Laptop (50W × 3 hours) = 150 Wh
- Refrigerator (150W × 8 hours run time) = 1200 Wh
- **Total: 1570 Wh/day + 30% buffer = ~2040 Wh/day**

## Solar Power

Solar panels are the most accessible renewable energy source for off-grid systems.

### Panel Types
- **Monocrystalline**: Most efficient (20-22%). Best for limited space. More expensive
- **Polycrystalline**: Slightly less efficient (15-17%). More affordable
- **Thin-film**: Flexible, lightweight, least efficient (10-13%). Good for portable applications

### Sizing Your Solar Array
- Determine peak sun hours for your location (typically 4-6 hours in most of the US)
- Divide daily energy need by peak sun hours: 2040 Wh ÷ 5 hours = 408W of solar panels needed
- Round up and account for losses: 500-600W of panels recommended for this example

### Panel Positioning
- Face panels true south in the Northern Hemisphere
- Optimal tilt angle equals your latitude (adjustable by season: flatter in summer, steeper in winter)
- Avoid any shade — even partial shade on one cell reduces output of the entire panel
- Clean panels monthly for maximum output

## Charge Controllers

The charge controller regulates voltage and current from solar panels to batteries, preventing overcharging.

**Types:**
- **PWM (Pulse Width Modulation)**: Simpler, cheaper. Best for small systems where panel voltage matches battery voltage
- **MPPT (Maximum Power Point Tracking)**: 20-30% more efficient than PWM. Converts excess voltage to additional charging current. Recommended for any system over 200W

**Sizing**: Match controller amperage to your system. Calculate: panel wattage ÷ battery voltage × 1.25 safety factor. Example: 500W panels ÷ 12V battery × 1.25 = 52A controller needed

## Battery Storage

Batteries store energy for use when the sun is not shining.

### Battery Chemistry Comparison

**Lithium Iron Phosphate (LiFePO4/LFP)** — Recommended:
- 80-90% depth of discharge (use most of stored energy)
- 2000-5000 charge cycles (5-10+ year lifespan)
- Lightweight, maintenance-free
- Built-in battery management system (BMS)
- Higher upfront cost but best long-term value

**Lead-Acid (flooded):**
- Only 50% depth of discharge recommended
- 300-500 charge cycles (2-4 year lifespan)
- Requires regular water topping and equalization charges
- Cheapest upfront but shortest lifespan
- Must be kept upright, produces hydrogen gas (ventilation required)

**AGM (Absorbed Glass Mat):**
- 50% depth of discharge
- 500-800 charge cycles
- Sealed, maintenance-free
- Mid-range cost

### Battery Bank Sizing
Calculate for 1-2 days of autonomy (backup for no-sun days):
- Daily need: 2040 Wh
- 2 days autonomy: 4080 Wh
- For LiFePO4 at 80% DoD: 4080 ÷ 0.80 = 5100 Wh battery bank needed
- At 12V: 5100 Wh ÷ 12V = 425 Ah of batteries

### System Voltage Selection
- **12V**: Simple, good for small systems under 1000W. Uses standard automotive components
- **24V**: Better for medium systems 1000-3000W. Reduces wire size requirements
- **48V**: Best for large home systems over 3000W. Most efficient, smallest wire sizes. Recommended for permanent installations

## Inverters

Inverters convert DC battery power to AC household power (120V or 240V).

**Pure Sine Wave** — Required for:
- Computers and electronics
- Medical equipment
- Motors (fans, pumps, power tools)
- LED lighting and chargers
- Any sensitive equipment

**Modified Sine Wave** — Only acceptable for:
- Simple resistive loads (incandescent bulbs, basic heaters)
- Not recommended for any modern electronics

**Sizing**: Calculate your peak simultaneous load + 20% headroom. If you might run a 1500W microwave while charging a phone (10W) and running lights (50W), get at minimum a 2000W inverter.

## Wind Power

Wind turbines complement solar by generating power at night and during cloudy/winter conditions.

**Requirements:**
- Consistent winds averaging 10+ mph at turbine height
- Tower height is critical — wind speed increases significantly with height. Mount at least 30 feet above any obstruction within 500 feet
- Small residential turbines: 400W-3000W range typical for off-grid
- Most cost-effective alongside solar in hybrid systems
- Requires maintenance — bearings, blades, charge controller specific to wind

## Micro-Hydro Power

If you have a flowing water source, micro-hydro is the most reliable renewable energy.

**Advantages:**
- Generates power 24 hours a day, 7 days a week
- More consistent than solar or wind
- Can dramatically reduce battery bank requirements

**Requirements:**
- Flowing water with sufficient head (vertical drop) and flow rate
- Even small streams with 2+ gallons per minute and 10+ feet of head can generate useful power
- Power output = Head (feet) × Flow (gallons/minute) ÷ 10 (rough estimate in watts)
- Example: 20 feet of head × 5 GPM ÷ 10 = 10W continuous = 240 Wh/day

## Installation Safety

**Critical installation sequence to prevent arcing and damage:**
1. Connect charge controller to battery bank FIRST
2. Connect solar panels (or wind/hydro source) to charge controller SECOND
3. Connect inverter to battery bank LAST
4. Reverse the sequence when disconnecting

**Fusing and Protection:**
- Install fuses or circuit breakers between EVERY major component
- Panel array → fuse → charge controller → fuse → battery bank → fuse → inverter
- Use appropriately sized wire (consult wire gauge charts for your amperage and distance)
- All connections must be tight and weather-protected to prevent fire

## Emergency and Backup Power

### Hand-Crank and Human Power
- Sustained human output: approximately 75 watts (vigorous pedaling on a bicycle generator)
- Hand-crank generators: typically 5-20 watts — enough for phone charging or radio
- Bicycle generators: belt-driven alternator on a stationary bike, 50-100W output

### Thermoelectric Generators (TEG)
- Peltier devices generate electricity from temperature differential
- Place one side on a heat source (fire, stove) and keep the other side cool
- Low output (5-15W typically) but requires no moving parts and no fuel beyond heat
- Useful for charging small devices and running LED lights
