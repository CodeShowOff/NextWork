I confirmed the app already supports custom backend URLs in the login screen, so I’ll fetch your PC LAN IP next and give you the exact URLs to enter on your phone.

Ran terminal command: Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object IPAddress,InterfaceAlias | Format-Table -AutoSize

Exactly, this is the key point:

Localhost on your phone is the phone itself, not your PC.

How they communicate:
1. Run backend on your PC.
2. Phone and PC must be on the same Wi-Fi network.
3. In the app login screen, set:
- API URL: http://192.168.13.115:4000/api/v1
- Realtime URL: http://192.168.13.115:4000/realtime

I checked your PC LAN IP and this is the right Wi-Fi address:
1. 192.168.13.115

Also do these checks:
1. Backend is running.
2. PostgreSQL and Redis are running.
3. Windows Firewall allows inbound TCP port 4000.
4. Test from phone browser: http://192.168.13.115:4000/api/v1/health

If you use Android emulator instead of real phone:
1. Keep default host flow (10.0.2.2) and it should connect to your PC localhost automatically.

If you want, I can now set a firewall rule command for port 4000 and verify connectivity steps with you in order.