extends Node

## Handles ENet connections to the social hub.

signal peer_authenticated(peer_id: int, profile: Dictionary)
signal peer_disconnected(peer_id: int)
signal authentication_failed(reason: String)

const DEFAULT_HUB_PORT := 7777

var peer: ENetMultiplayerPeer
var is_hub_server := false
var join_token := ""
var connected_peers: Dictionary = {}


func is_connected_to_hub() -> bool:
	return peer != null and multiplayer.multiplayer_peer != null


func start_server(port: int = DEFAULT_HUB_PORT) -> Error:
	peer = ENetMultiplayerPeer.new()
	var err := peer.create_server(port, 32)
	if err != OK:
		return err

	multiplayer.multiplayer_peer = peer
	is_hub_server = true
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	print("Hub server listening on port %s" % port)
	return OK


func connect_as_client(host: String, port: int, token: String) -> Dictionary:
	join_token = token
	peer = ENetMultiplayerPeer.new()
	var err := peer.create_client(host, port)
	if err != OK:
		return {"ok": false, "error": "Could not create network client"}

	multiplayer.multiplayer_peer = peer

	var elapsed := 0.0
	while multiplayer.get_unique_id() == 0 and elapsed < 5.0:
		await get_tree().process_frame
		elapsed += get_process_delta_time()

	if multiplayer.get_unique_id() == 0:
		disconnect_from_hub()
		return {"ok": false, "error": "Timed out connecting to hub. Is scripts/run-hub-server.sh running?"}

	return {"ok": true}


func disconnect_from_hub() -> void:
	if peer:
		peer.close()
	peer = null
	if multiplayer.multiplayer_peer:
		multiplayer.multiplayer_peer = null


func register_with_server() -> void:
	if is_hub_server:
		return
	if join_token.is_empty():
		authentication_failed.emit("Missing hub join token")
		return
	submit_join_token.rpc_id(1, join_token)


func validate_join_token(token: String) -> Dictionary:
	var http := HTTPRequest.new()
	add_child(http)

	var body := JSON.stringify({"joinToken": token})
	var err := http.request(
		"%s/world/validate-hub-join" % ApiClient.api_url,
		PackedStringArray(["Content-Type: application/json"]),
		HTTPClient.METHOD_POST,
		body
	)
	if err != OK:
		http.queue_free()
		return {"ok": false, "error": "Failed to validate join token"}

	var result = await http.request_completed
	http.queue_free()

	var response_code: int = result[1]
	var response_body: String = result[3].get_string_from_utf8()
	var parsed: Variant = JSON.parse_string(response_body)

	if response_code >= 400 or typeof(parsed) != TYPE_DICTIONARY:
		var message := "Join token rejected (HTTP %s)" % response_code
		if typeof(parsed) == TYPE_DICTIONARY and parsed.has("message"):
			message = str(parsed["message"])
		print("Hub auth failed: %s | body=%s" % [message, response_body])
		return {"ok": false, "error": message}

	return {"ok": true, "data": parsed}


@rpc("any_peer", "call_remote", "reliable")
func submit_join_token(token: String) -> void:
	if not multiplayer.is_server():
		return
	_authenticate_peer(multiplayer.get_remote_sender_id(), token)


func _authenticate_peer(peer_id: int, token: String) -> void:
	var validation := await validate_join_token(token)
	if not validation.ok:
		push_warning("Rejected peer %s: %s" % [peer_id, validation.error])
		auth_failed.rpc_id(peer_id, validation.error)
		multiplayer.disconnect_peer(peer_id)
		return

	print("Hub authenticated peer %s as %s" % [peer_id, validation.data.get("displayName", "?")])
	connected_peers[peer_id] = validation.data
	peer_authenticated.emit(peer_id, validation.data)


@rpc("authority", "call_remote", "reliable")
func auth_failed(reason: String) -> void:
	authentication_failed.emit(reason)


func _on_peer_connected(peer_id: int) -> void:
	print("Peer connected: %s" % peer_id)


func _on_peer_disconnected(peer_id: int) -> void:
	print("Peer disconnected: %s" % peer_id)
	connected_peers.erase(peer_id)
	peer_disconnected.emit(peer_id)
