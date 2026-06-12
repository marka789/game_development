extends Node

## Small hand-off layer between API and scenes.

signal profile_loaded(profile: Dictionary)

var profile: Dictionary = {}
var hub_join_info: Dictionary = {}


func load_profile() -> Dictionary:
	var result := await ApiClient.fetch_profile()
	if result.ok:
		profile = result.data
		profile_loaded.emit(profile)
	return result
