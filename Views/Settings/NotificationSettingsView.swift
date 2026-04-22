import SwiftUI

struct NotificationSettingsView: View {
    @Environment(\.appTheme) var theme
    @Bindable var settings: AppSettings

    @State private var authStatus: String = "Checking..."
    @State private var pendingDescriptions: [String] = []
    @State private var showingPending = false

    private let dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    var body: some View {
        Form {
            Section("Reminders") {
                Toggle("Enable notifications", isOn: $settings.notificationsEnabled)
                    .onChange(of: settings.notificationsEnabled) { reschedule() }

                if settings.notificationsEnabled {
                    morningPicker
                    eveningPicker
                    daysPicker
                }
            }
            .listRowBackground(theme.card)

            Section("Permission Status") {
                Text(authStatus)
                    .foregroundStyle(theme.secondary)
                    .font(.subheadline)
            }
            .listRowBackground(theme.card)

            Section {
                Button("Verify scheduled notifications") {
                    Task {
                        pendingDescriptions = await NotificationManager.shared.pendingNotificationDescriptions()
                        showingPending = true
                    }
                }
                .foregroundStyle(theme.accent)
            }
            .listRowBackground(theme.card)
        }
        .scrollContentBackground(.hidden)
        .background(theme.bg.ignoresSafeArea())
        .navigationTitle("Notifications")
        .alert("Scheduled Notifications (\(pendingDescriptions.count))", isPresented: $showingPending) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(pendingDescriptions.isEmpty
                 ? "None scheduled."
                 : pendingDescriptions.prefix(10).joined(separator: "\n"))
        }
        .onAppear { checkStatus() }
    }

    // MARK: - Pickers

    private var morningPicker: some View {
        HStack {
            Text("Morning")
            Spacer()
            TimePicker2(value: $settings.morningReminderTime)
                .onChange(of: settings.morningReminderTime) { reschedule() }
        }
    }

    private var eveningPicker: some View {
        HStack {
            Text("Evening")
            Spacer()
            TimePicker2(value: $settings.eveningReminderTime)
                .onChange(of: settings.eveningReminderTime) { reschedule() }
        }
    }

    private var daysPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Active days")
                .font(.subheadline)
                .foregroundStyle(theme.secondary)
            HStack {
                ForEach(0..<7, id: \.self) { day in
                    let isOn = settings.reminderDays.contains(day)
                    Button {
                        var days = settings.reminderDays
                        if isOn { days.removeAll { $0 == day } }
                        else    { days.append(day) }
                        settings.reminderDays = days
                        reschedule()
                    } label: {
                        Text(String(dayNames[day].prefix(2)))
                            .font(.caption.weight(.semibold))
                            .frame(width: 34, height: 34)
                            .background(isOn ? theme.accent : theme.card)
                            .foregroundStyle(isOn ? .white : theme.secondary)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Helpers

    private func checkStatus() {
        Task {
            let status = await NotificationManager.shared.authorizationStatus()
            switch status {
            case .authorized:   authStatus = "✅ Authorized"
            case .denied:       authStatus = "❌ Denied — enable in iOS Settings"
            case .notDetermined:authStatus = "⚠️ Not yet requested"
            default:            authStatus = "Unknown"
            }
        }
    }

    private func reschedule() {
        Task {
            if settings.notificationsEnabled {
                let granted = await NotificationManager.shared.requestAuthorization()
                if granted {
                    await NotificationManager.shared.reschedule(settings: settings)
                }
            } else {
                await NotificationManager.shared.reschedule(settings: settings)
            }
            checkStatus()
        }
    }
}

/// Compact HH:mm picker using a DatePicker
private struct TimePicker2: View {
    @Binding var value: String
    @State private var time: Date = Date()

    var body: some View {
        DatePicker("", selection: $time, displayedComponents: .hourAndMinute)
            .labelsHidden()
            .onChange(of: time) {
                let c = Calendar.current.dateComponents([.hour, .minute], from: time)
                value = String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
            }
            .onAppear {
                if let parts = value.parseHHmm() {
                    var c = DateComponents(); c.hour = parts.hour; c.minute = parts.minute
                    time = Calendar.current.date(from: c) ?? Date()
                }
            }
    }
}