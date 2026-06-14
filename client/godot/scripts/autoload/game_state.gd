extends Node

signal profile_loaded(profile: Dictionary)
signal hunt_transition_started()
signal returned_to_hub()

var profile: Dictionary = {}
var hub_join_info: Dictionary = {}
var hunt_join_info: Dictionary = {}
var hunt_session_id: String = ""
var last_hunt_rewards: Dictionary = {}
var _transitioning := false


func is_transitioning() -> bool:
	return _transitioning


func load_profile() -> Dictionary:
	var result := await ApiClient.fetch_profile()
	if result.ok:
		profile = result.data
		profile_loaded.emit(profile)
	return result


func enter_hunt(connection: Dictionary) -> Dictionary:
	if _transitioning:
		return {"ok": false, "error": "Already transitioning"}
	_transitioning = true
	hunt_transition_started.emit()

	hunt_join_info = connection
	hunt_session_id = str(connection.get("huntSessionId", ""))

	HubNetwork.disconnect_from_hub()

	var connect_result := await HuntNetwork.connect_as_client(
		str(connection.get("huntHost", "127.0.0.1")),
		int(connection.get("huntPort", 7800)),
		str(connection.get("joinToken", "")),
	)
	_transitioning = false
	return connect_result


func return_to_hub() -> Dictionary:
	if _transitioning:
		return {"ok": false, "error": "Already transitioning"}
	_transitioning = true

	HuntNetwork.disconnect_from_hunt()

	var join_result := await ApiClient.join_hub()
	if not join_result.ok:
		_transitioning = false
		return join_result

	hub_join_info = join_result.data
	var connect_result := await HubNetwork.connect_as_client(
		str(join_result.data.get("hubHost", "127.0.0.1")),
		int(join_result.data.get("hubPort", 7777)),
		str(join_result.data.get("joinToken", "")),
	)
	_transitioning = false
	if connect_result.ok:
		returned_to_hub.emit()
	return connect_result
