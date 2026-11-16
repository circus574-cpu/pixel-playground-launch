class_name RaceKits
extends RefCounted
## Factory of the four race kits.

static func create(race: String, data: Dictionary) -> RaceKit:
	match race:
		"planetary":
			return PlanetaryKit.new(data)
		"sage":
			return SageKit.new(data)
		"android":
			return AndroidKit.new(data)
	return LegendKit.new(data)
