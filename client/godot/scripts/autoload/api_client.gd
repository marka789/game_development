extends Node

## Talks to the TypeScript platform API.
## All game persistence (login, friends, party, loot) goes through here.

const DEFAULT_API_URL := "http://127.0.0.1:3000"

var api_url: String = DEFAULT_API_URL
var token: String = ""


func set_api_url(url: String) -> void:
	api_url = url.trim_suffix("/")


func is_logged_in() -> bool:
	return token != ""


func _build_headers(include_json: bool) -> PackedStringArray:
	var headers := PackedStringArray()
	if include_json:
		headers.append("Content-Type: application/json")
	if token != "":
		headers.append("Authorization: Bearer %s" % token)
	return headers


func _request(method: int, path: String, body: Dictionary = {}) -> Dictionary:
	var http := HTTPRequest.new()
	add_child(http)

	var sends_json := method == HTTPClient.METHOD_POST or method == HTTPClient.METHOD_PUT or method == HTTPClient.METHOD_PATCH
	var json_body := ""
	if sends_json:
		# Fastify rejects Content-Type: application/json with an empty body.
		json_body = JSON.stringify(body)

	var err := http.request("%s%s" % [api_url, path], _build_headers(sends_json), method, json_body)
	if err != OK:
		http.queue_free()
		return {"ok": false, "error": "Failed to start HTTP request"}

	var result = await http.request_completed
	http.queue_free()

	var response_code: int = result[1]
	var response_body: String = result[3].get_string_from_utf8()
	var parsed: Variant = JSON.parse_string(response_body)

	if response_code >= 400:
		var message := "Request failed (%s)" % response_code
		if typeof(parsed) == TYPE_DICTIONARY:
			if parsed.has("message"):
				message = str(parsed["message"])
			elif parsed.has("error"):
				message = str(parsed["error"])
		return {"ok": false, "error": message, "status": response_code}

	if typeof(parsed) != TYPE_DICTIONARY:
		return {"ok": false, "error": "Invalid JSON response"}

	return {"ok": true, "data": parsed}


func login(username: String, password: String) -> Dictionary:
	var result := await _request(HTTPClient.METHOD_POST, "/auth/login", {
		"username": username,
		"password": password,
	})
	if result.ok:
		token = result.data.get("token", "")
	return result


func register(username: String, password: String, display_name: String) -> Dictionary:
	var result := await _request(HTTPClient.METHOD_POST, "/auth/register", {
		"username": username,
		"password": password,
		"displayName": display_name,
	})
	if result.ok:
		token = result.data.get("token", "")
	return result


func fetch_profile() -> Dictionary:
	return await _request(HTTPClient.METHOD_GET, "/me")


func join_hub() -> Dictionary:
	return await _request(HTTPClient.METHOD_POST, "/world/join-hub")


func fetch_party() -> Dictionary:
	return await _request(HTTPClient.METHOD_GET, "/party")


func create_party() -> Dictionary:
	return await _request(HTTPClient.METHOD_POST, "/party/create")


func invite_to_party(username: String) -> Dictionary:
	return await _request(HTTPClient.METHOD_POST, "/party/invite", {"username": username})


func start_hunt() -> Dictionary:
	return await _request(HTTPClient.METHOD_POST, "/party/start-hunt")


func fetch_friends() -> Dictionary:
	return await _request(HTTPClient.METHOD_GET, "/friends")


func request_friend(username: String) -> Dictionary:
	return await _request(HTTPClient.METHOD_POST, "/friends/request", {"username": username})


func accept_friend(username: String) -> Dictionary:
	return await _request(HTTPClient.METHOD_POST, "/friends/accept", {"username": username})


func leave_party() -> Dictionary:
	return await _request(HTTPClient.METHOD_POST, "/party/leave")


func set_party_ready(ready: bool) -> Dictionary:
	return await _request(HTTPClient.METHOD_POST, "/party/ready", {"ready": ready})


func complete_hunt(hunt_session_id: String, success: bool) -> Dictionary:
	return await _request(HTTPClient.METHOD_POST, "/hunt/complete", {
		"huntSessionId": hunt_session_id,
		"success": success,
	})
