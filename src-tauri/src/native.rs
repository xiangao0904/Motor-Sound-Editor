use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{Cursor, ErrorKind, Read, Write};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::{MediaSource, MediaSourceStream};
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::default::{get_codecs, get_probe};
use tauri::{AppHandle, Manager};
#[cfg(target_os = "windows")]
use winreg::enums::HKEY_CURRENT_USER;
#[cfg(target_os = "windows")]
use winreg::RegKey;
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const PROJECT_FILE_NAME: &str = "project.json";
const TRACKS_FILE_NAME: &str = "tracks.json";
const SAFE_MIN_PITCH: f64 = 0.01;
const BVE_CSV_HEADER: &str = "bvets motor noise table 0.01";

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum CurveKind {
    Pitch,
    Volume,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum CurveSetKind {
    Traction,
    Brake,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Keyframe {
    id: String,
    speed: f64,
    value: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackCurve {
    kind: CurveKind,
    interpolation: String,
    keyframes: Vec<Keyframe>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackCurveSet {
    pitch: TrackCurve,
    volume: TrackCurve,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    id: String,
    name: String,
    color: String,
    asset_id: Option<String>,
    enabled: bool,
    mute: bool,
    curve_sets: HashMap<CurveSetKind, TrackCurveSet>,
    locked: Option<bool>,
    visible: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioAsset {
    id: String,
    file_name: String,
    original_path: Option<String>,
    packaged_path: String,
    format: String,
    size: u64,
    checksum: Option<String>,
    duration_sec: Option<f64>,
    sample_rate: Option<u32>,
    channels: Option<u32>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMeta {
    id: String,
    name: String,
    author: Option<String>,
    app_version: String,
    schema_version: u32,
    created_at: String,
    updated_at: String,
    max_speed: f64,
    acceleration: f64,
    brake_deceleration: f64,
    description: Option<String>,
    last_opened_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ProjectFile {
    meta: ProjectMeta,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TracksFile {
    active_track_id: Option<String>,
    tracks: Vec<Track>,
    assets: Vec<AudioAsset>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ProjectDocument {
    project: ProjectFile,
    tracks: TracksFile,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedNativeProject {
    document: ProjectDocument,
    asset_payloads: HashMap<String, Vec<u8>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioMetadataSource {
    asset_id: Option<String>,
    path: Option<String>,
    file_name: Option<String>,
    bytes: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioMetadataResult {
    asset_id: Option<String>,
    path: Option<String>,
    duration_sec: Option<f64>,
    sample_rate: Option<u32>,
    channels: Option<u32>,
    error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SampledTrackCurves {
    track_id: String,
    pitch: Vec<f64>,
    volume: Vec<f64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BveExportOptions {
    format: String,
    sample_rate: u32,
}

#[derive(Debug, Clone)]
struct DecodedAudio {
    sample_rate: u32,
    channels: Vec<Vec<f32>>,
}

#[derive(Debug, Clone)]
struct ExportableTrack {
    track: Track,
    asset: AudioAsset,
    bytes: Vec<u8>,
    file_name: String,
}

impl Track {
    fn curve_set(&self, kind: CurveSetKind) -> Result<&TrackCurveSet, String> {
        self.curve_sets
            .get(&kind)
            .ok_or_else(|| format!("Track {} is missing {:?} curves", self.name, kind))
    }
}

pub fn is_msep_path(path: &str) -> bool {
    let extension = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();

    extension.eq_ignore_ascii_case("msep")
}

fn ensure_msep_path(path: &str) -> Result<(), String> {
    if is_msep_path(path) {
        Ok(())
    } else {
        Err("Only .msep files are supported".to_string())
    }
}

pub fn msep_path_from_args<I>(args: I) -> Option<String>
where
    I: IntoIterator<Item = String>,
{
    args.into_iter().find(|arg| is_msep_path(arg))
}

fn normalize_curve_value(kind: CurveKind, value: f64) -> f64 {
    if !value.is_finite() {
        return if kind == CurveKind::Pitch {
            SAFE_MIN_PITCH
        } else {
            0.0
        };
    }

    match kind {
        CurveKind::Pitch if value <= 0.0 => SAFE_MIN_PITCH,
        CurveKind::Pitch => value.max(SAFE_MIN_PITCH),
        CurveKind::Volume => value.max(0.0),
    }
}

fn sample_curve(curve: &TrackCurve, speed: f64) -> f64 {
    let keyframes = &curve.keyframes;

    if keyframes.is_empty() {
        return if curve.kind == CurveKind::Pitch {
            1.0
        } else {
            0.0
        };
    }

    if speed <= keyframes[0].speed {
        return normalize_curve_value(curve.kind, keyframes[0].value);
    }

    let mut low = 1usize;
    let mut high = keyframes.len().saturating_sub(1);
    let mut next_index = keyframes.len();

    while low <= high {
        let mid = (low + high) / 2;

        if speed <= keyframes[mid].speed {
            next_index = mid;
            if mid == 0 {
                break;
            }
            high = mid.saturating_sub(1);
        } else {
            low = mid + 1;
        }
    }

    let value = if next_index == keyframes.len() {
        keyframes[keyframes.len() - 1].value
    } else {
        let previous = &keyframes[next_index - 1];
        let next = &keyframes[next_index];
        let span = next.speed - previous.speed;
        let ratio = if span == 0.0 {
            0.0
        } else {
            (speed - previous.speed) / span
        };
        previous.value + (next.value - previous.value) * ratio
    };

    normalize_curve_value(curve.kind, value)
}

fn safe_zip_segment(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            ch if ch.is_control() => '_',
            ch => ch,
        })
        .collect::<String>();

    let trimmed = sanitized.split_whitespace().collect::<Vec<_>>().join(" ");
    if trimmed.is_empty() {
        "Motor Sound Export".to_string()
    } else {
        trimmed
    }
}

fn format_number(value: f64) -> String {
    if !value.is_finite() {
        return "0".to_string();
    }

    let mut text = format!("{value:.6}");
    while text.contains('.') && text.ends_with('0') {
        text.pop();
    }
    if text.ends_with('.') {
        text.pop();
    }

    if text == "-0" {
        "0".to_string()
    } else {
        text
    }
}

fn create_msep_archive(
    document: &ProjectDocument,
    asset_payloads: &HashMap<String, Vec<u8>>,
) -> Result<Vec<u8>, String> {
    let compact_document = compact_project_document(document, asset_payloads);
    let cursor = Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(cursor);
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

    zip.start_file(PROJECT_FILE_NAME, options)
        .map_err(|error| error.to_string())?;
    zip.write_all(
        &serde_json::to_vec_pretty(&compact_document.project).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;

    zip.start_file(TRACKS_FILE_NAME, options)
        .map_err(|error| error.to_string())?;
    zip.write_all(&serde_json::to_vec_pretty(&compact_document.tracks).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())?;

    for asset in &compact_document.tracks.assets {
        if let Some(bytes) = asset_payloads.get(&asset.id) {
            zip.start_file(&asset.packaged_path, options)
                .map_err(|error| error.to_string())?;
            zip.write_all(bytes).map_err(|error| error.to_string())?;
        }
    }

    zip.finish()
        .map(|cursor| cursor.into_inner())
        .map_err(|error| error.to_string())
}

fn compact_project_document(
    document: &ProjectDocument,
    asset_payloads: &HashMap<String, Vec<u8>>,
) -> ProjectDocument {
    let mut compact_document = document.clone();
    let referenced_asset_ids = compact_document
        .tracks
        .tracks
        .iter()
        .filter_map(|track| track.asset_id.clone())
        .collect::<HashSet<_>>();

    compact_document.tracks.assets.retain(|asset| {
        referenced_asset_ids.contains(&asset.id) && asset_payloads.contains_key(&asset.id)
    });

    let valid_asset_ids = compact_document
        .tracks
        .assets
        .iter()
        .map(|asset| asset.id.clone())
        .collect::<HashSet<_>>();

    for track in &mut compact_document.tracks.tracks {
        if let Some(asset_id) = &track.asset_id {
            if !valid_asset_ids.contains(asset_id) {
                track.asset_id = None;
            }
        }
    }

    compact_document
}

fn decode_audio_source(
    path: Option<String>,
    file_name: Option<String>,
    bytes: Option<Vec<u8>>,
) -> Result<DecodedAudio, String> {
    let mut hint = Hint::new();
    let extension_source = path
        .as_deref()
        .and_then(|value| Path::new(value).extension().and_then(|ext| ext.to_str()))
        .or_else(|| {
            file_name
                .as_deref()
                .and_then(|value| Path::new(value).extension().and_then(|ext| ext.to_str()))
        });
    if let Some(extension) = extension_source {
        hint.with_extension(extension);
    }

    let media_source: Box<dyn MediaSource> = if let Some(path) = path {
        Box::new(File::open(path).map_err(|error| error.to_string())?)
    } else if let Some(bytes) = bytes {
        Box::new(Cursor::new(bytes))
    } else {
        return Err("Audio metadata request did not include a path or bytes".to_string());
    };

    let stream = MediaSourceStream::new(media_source, Default::default());
    let probed = get_probe()
        .format(
            &hint,
            stream,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|error| error.to_string())?;
    let mut format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| "Audio file does not contain a default track".to_string())?;
    let track_id = track.id;
    let mut decoder = get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|error| error.to_string())?;

    let mut sample_rate = track.codec_params.sample_rate.unwrap_or_default();
    let mut channel_count = track
        .codec_params
        .channels
        .map(|channels| channels.count())
        .unwrap_or_default();
    let mut channels = if channel_count == 0 {
        Vec::new()
    } else {
        vec![Vec::new(); channel_count]
    };

    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(SymphoniaError::IoError(error)) if error.kind() == ErrorKind::UnexpectedEof => {
                break
            }
            Err(SymphoniaError::ResetRequired) => {
                return Err("Audio stream reset is not supported".to_string())
            }
            Err(error) => return Err(error.to_string()),
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = decoder.decode(&packet).map_err(|error| error.to_string())?;
        let spec = *decoded.spec();
        if sample_rate == 0 {
            sample_rate = spec.rate;
        }
        if channel_count == 0 {
            channel_count = spec.channels.count();
            channels = vec![Vec::new(); channel_count];
        }

        let mut sample_buffer = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
        sample_buffer.copy_interleaved_ref(decoded);
        for frame in sample_buffer.samples().chunks(channel_count) {
            for (channel_index, sample) in frame.iter().enumerate() {
                channels[channel_index].push(*sample);
            }
        }
    }

    if sample_rate == 0 || channels.is_empty() {
        return Err("Audio file did not yield any decoded samples".to_string());
    }

    Ok(DecodedAudio {
        sample_rate,
        channels,
    })
}

fn metadata_from_decoded_audio(decoded: &DecodedAudio) -> AudioMetadataResult {
    let frame_count = decoded
        .channels
        .first()
        .map(|channel| channel.len())
        .unwrap_or(0);
    AudioMetadataResult {
        asset_id: None,
        path: None,
        duration_sec: Some(frame_count as f64 / decoded.sample_rate as f64),
        sample_rate: Some(decoded.sample_rate),
        channels: Some(decoded.channels.len() as u32),
        error: None,
    }
}

fn resample_audio(decoded: &DecodedAudio, target_sample_rate: u32) -> DecodedAudio {
    if decoded.sample_rate == target_sample_rate || decoded.channels.is_empty() {
        return decoded.clone();
    }

    let input_length = decoded.channels[0].len();
    if input_length == 0 {
        return DecodedAudio {
            sample_rate: target_sample_rate,
            channels: decoded.channels.clone(),
        };
    }

    let output_length = ((input_length as f64 * target_sample_rate as f64)
        / decoded.sample_rate as f64)
        .ceil() as usize;
    let mut resampled_channels = Vec::with_capacity(decoded.channels.len());

    for channel in &decoded.channels {
        let mut resampled = Vec::with_capacity(output_length);
        for output_index in 0..output_length {
            let position =
                output_index as f64 * decoded.sample_rate as f64 / target_sample_rate as f64;
            let left_index = position.floor() as usize;
            let right_index = (left_index + 1).min(channel.len().saturating_sub(1));
            let fraction = (position - left_index as f64) as f32;
            let left = channel[left_index];
            let right = channel[right_index];
            resampled.push(left + (right - left) * fraction);
        }
        resampled_channels.push(resampled);
    }

    DecodedAudio {
        sample_rate: target_sample_rate,
        channels: resampled_channels,
    }
}

fn encode_wav_pcm16(decoded: &DecodedAudio) -> Vec<u8> {
    let channel_count = decoded.channels.len() as u16;
    let sample_count = decoded
        .channels
        .first()
        .map(|channel| channel.len())
        .unwrap_or(0);
    let bytes_per_sample = 2u16;
    let block_align = channel_count * bytes_per_sample;
    let byte_rate = decoded.sample_rate * block_align as u32;
    let data_size = sample_count as u32 * block_align as u32;

    let mut output = Vec::with_capacity(44 + data_size as usize);
    output.extend_from_slice(b"RIFF");
    output.extend_from_slice(&(36 + data_size).to_le_bytes());
    output.extend_from_slice(b"WAVE");
    output.extend_from_slice(b"fmt ");
    output.extend_from_slice(&16u32.to_le_bytes());
    output.extend_from_slice(&1u16.to_le_bytes());
    output.extend_from_slice(&channel_count.to_le_bytes());
    output.extend_from_slice(&decoded.sample_rate.to_le_bytes());
    output.extend_from_slice(&byte_rate.to_le_bytes());
    output.extend_from_slice(&block_align.to_le_bytes());
    output.extend_from_slice(&(bytes_per_sample * 8).to_le_bytes());
    output.extend_from_slice(b"data");
    output.extend_from_slice(&data_size.to_le_bytes());

    for sample_index in 0..sample_count {
        for channel in &decoded.channels {
            let sample = channel
                .get(sample_index)
                .copied()
                .unwrap_or(0.0)
                .clamp(-1.0, 1.0);
            let pcm = if sample < 0.0 {
                sample * i16::MIN as f32
            } else {
                sample * i16::MAX as f32
            };
            output.extend_from_slice(&(pcm as i16).to_le_bytes());
        }
    }

    output
}

fn collect_speeds(
    tracks: &[ExportableTrack],
    curve_set: CurveSetKind,
    kind: CurveKind,
) -> Vec<f64> {
    let mut speeds = Vec::new();

    for exportable in tracks {
        if let Ok(curves) = exportable.track.curve_set(curve_set) {
            let curve = match kind {
                CurveKind::Pitch => &curves.pitch,
                CurveKind::Volume => &curves.volume,
            };

            for keyframe in &curve.keyframes {
                if keyframe.speed.is_finite() {
                    let rounded = (keyframe.speed * 1_000_000.0).round() / 1_000_000.0;
                    speeds.push(rounded);
                }
            }
        }
    }

    if speeds.is_empty() {
        speeds.push(0.0);
    }

    speeds.sort_by(|left, right| left.partial_cmp(right).unwrap_or(std::cmp::Ordering::Equal));
    speeds.dedup_by(|left, right| (*left - *right).abs() < 0.000_001);
    speeds
}

fn create_motor_noise_csv(
    tracks: &[ExportableTrack],
    curve_set: CurveSetKind,
    kind: CurveKind,
) -> Result<String, String> {
    let speeds = collect_speeds(tracks, curve_set, kind);
    let rows = speeds
        .into_iter()
        .map(|speed| {
            let mut values = vec![format_number(speed)];
            for exportable in tracks {
                let curve_set_data = exportable.track.curve_set(curve_set)?;
                let curve = match kind {
                    CurveKind::Pitch => &curve_set_data.pitch,
                    CurveKind::Volume => &curve_set_data.volume,
                };
                values.push(format_number(sample_curve(curve, speed)));
            }
            Ok(values.join(","))
        })
        .collect::<Result<Vec<_>, String>>()?;

    Ok(std::iter::once(BVE_CSV_HEADER.to_string())
        .chain(rows)
        .collect::<Vec<_>>()
        .join("\r\n"))
}

fn exportable_tracks(
    document: &ProjectDocument,
    asset_payloads: &HashMap<String, Vec<u8>>,
) -> Vec<ExportableTrack> {
    let asset_by_id = document
        .tracks
        .assets
        .iter()
        .cloned()
        .map(|asset| (asset.id.clone(), asset))
        .collect::<HashMap<_, _>>();

    document
        .tracks
        .tracks
        .iter()
        .filter(|track| track.enabled && !track.mute)
        .filter_map(|track| {
            let asset_id = track.asset_id.as_ref()?;
            let asset = asset_by_id.get(asset_id)?.clone();
            let bytes = asset_payloads.get(asset_id)?.clone();
            Some((track.clone(), asset, bytes))
        })
        .enumerate()
        .map(|(index, (track, asset, bytes))| ExportableTrack {
            track,
            asset,
            bytes,
            file_name: format!("sound_{}.wav", index + 1),
        })
        .collect()
}

fn create_bve_archive(
    document: &ProjectDocument,
    asset_payloads: &HashMap<String, Vec<u8>>,
    options: &BveExportOptions,
) -> Result<Vec<u8>, String> {
    let tracks = exportable_tracks(document, asset_payloads);
    if tracks.is_empty() {
        return Err("No exportable tracks have assigned audio.".to_string());
    }

    let cursor = Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(cursor);
    let options_zip = FileOptions::default().compression_method(CompressionMethod::Deflated);
    let root_name = safe_zip_segment(&document.project.meta.name);

    zip.start_file(format!("{root_name}/vehicle.txt"), options_zip)
        .map_err(|error| error.to_string())?;
    zip.write_all(
        b"BveTs Vehicle 1.00\r\nSound = sound\\Sound.txt\r\nMotorNoise = motornoise\\motornoise.txt\r\n",
    )
    .map_err(|error| error.to_string())?;

    zip.start_file(
        format!("{root_name}/motornoise/motornoise.txt"),
        options_zip,
    )
    .map_err(|error| error.to_string())?;
    zip.write_all(
        b"[Power]\r\nVolume = powervol.csv\r\nFrequency = powerfreq.csv\r\n\r\n[Brake]\r\nVolume = brakevol.csv\r\nFrequency = brakefreq.csv\r\n",
    )
    .map_err(|error| error.to_string())?;

    for (path, curve_set, kind) in [
        (
            format!("{root_name}/motornoise/powerfreq.csv"),
            CurveSetKind::Traction,
            CurveKind::Pitch,
        ),
        (
            format!("{root_name}/motornoise/powervol.csv"),
            CurveSetKind::Traction,
            CurveKind::Volume,
        ),
        (
            format!("{root_name}/motornoise/brakefreq.csv"),
            CurveSetKind::Brake,
            CurveKind::Pitch,
        ),
        (
            format!("{root_name}/motornoise/brakevol.csv"),
            CurveSetKind::Brake,
            CurveKind::Volume,
        ),
    ] {
        zip.start_file(path, options_zip)
            .map_err(|error| error.to_string())?;
        zip.write_all(create_motor_noise_csv(&tracks, curve_set, kind)?.as_bytes())
            .map_err(|error| error.to_string())?;
    }

    zip.start_file(format!("{root_name}/sound/Sound.txt"), options_zip)
        .map_err(|error| error.to_string())?;
    let sound_table = std::iter::once("Version 1.0".to_string())
        .chain(std::iter::once(String::new()))
        .chain(std::iter::once("[Run]".to_string()))
        .chain(std::iter::once(String::new()))
        .chain(std::iter::once("[Motor]".to_string()))
        .chain(
            tracks
                .iter()
                .enumerate()
                .map(|(index, track)| format!("{index} = {}", track.file_name)),
        )
        .chain(std::iter::once(String::new()))
        .collect::<Vec<_>>()
        .join("\r\n");
    zip.write_all(sound_table.as_bytes())
        .map_err(|error| error.to_string())?;

    for track in &tracks {
        let decoded = decode_audio_source(
            None,
            Some(track.asset.file_name.clone()),
            Some(track.bytes.clone()),
        )?;
        let resampled = resample_audio(&decoded, options.sample_rate);
        let wav_bytes = encode_wav_pcm16(&resampled);
        zip.start_file(
            format!("{root_name}/sound/{}", track.file_name),
            options_zip,
        )
        .map_err(|error| error.to_string())?;
        zip.write_all(&wav_bytes)
            .map_err(|error| error.to_string())?;
    }

    zip.finish()
        .map(|cursor| cursor.into_inner())
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "windows")]
fn resolve_file_icon_path(app: &AppHandle) -> Option<PathBuf> {
    let resource_dir = app.path().resource_dir().ok()?;
    let nested = resource_dir.join("icons").join("file-ico.ico");
    if nested.exists() {
        return Some(nested);
    }

    let flat = resource_dir.join("file-ico.ico");
    if flat.exists() {
        return Some(flat);
    }

    None
}

#[cfg(target_os = "windows")]
pub fn register_msep_file_association(app: &AppHandle) {
    if cfg!(debug_assertions) {
        return;
    }

    let exe_path = match std::env::current_exe() {
        Ok(path) => path,
        Err(_) => return,
    };
    let icon_path = resolve_file_icon_path(app).unwrap_or_else(|| exe_path.clone());
    let classes_root = match RegKey::predef(HKEY_CURRENT_USER).create_subkey("Software\\Classes") {
        Ok((key, _)) => key,
        Err(_) => return,
    };

    if let Ok((extension_key, _)) = classes_root.create_subkey(".msep") {
        let _ = extension_key.set_value("", &"MotorSoundEditor.Project");
    }

    if let Ok((project_key, _)) = classes_root.create_subkey("MotorSoundEditor.Project") {
        let _ = project_key.set_value("", &"Motor Sound Editor Project");
        if let Ok((icon_key, _)) = project_key.create_subkey("DefaultIcon") {
            let _ = icon_key.set_value("", &format!("\"{}\",0", icon_path.display()));
        }
        if let Ok((command_key, _)) = project_key.create_subkey("shell\\open\\command") {
            let _ = command_key.set_value("", &format!("\"{}\" \"%1\"", exe_path.display()));
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn register_msep_file_association(_app: &AppHandle) {}

#[tauri::command]
pub fn read_msep_file(path: String) -> Result<Vec<u8>, String> {
    ensure_msep_path(&path)?;
    fs::read(path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn write_msep_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    ensure_msep_path(&path)?;
    fs::write(path, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn read_msep_modified_at(path: String) -> Result<u64, String> {
    ensure_msep_path(&path)?;
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    let modified_at = metadata.modified().map_err(|error| error.to_string())?;
    let duration = modified_at
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?;

    Ok(duration.as_millis() as u64)
}

#[tauri::command]
pub fn startup_msep_path() -> Option<String> {
    msep_path_from_args(std::env::args())
}

#[tauri::command]
pub fn read_audio_metadata_batch(
    items: Vec<AudioMetadataSource>,
) -> Result<Vec<AudioMetadataResult>, String> {
    let handles = items
        .into_iter()
        .map(|item| {
            std::thread::spawn(move || {
                let AudioMetadataSource {
                    asset_id,
                    path,
                    file_name,
                    bytes,
                } = item;

                match decode_audio_source(path.clone(), file_name, bytes) {
                    Ok(decoded) => {
                        let mut metadata = metadata_from_decoded_audio(&decoded);
                        metadata.asset_id = asset_id;
                        metadata.path = path;
                        metadata
                    }
                    Err(error) => AudioMetadataResult {
                        asset_id,
                        path,
                        duration_sec: None,
                        sample_rate: None,
                        channels: None,
                        error: Some(error),
                    },
                }
            })
        })
        .collect::<Vec<_>>();

    Ok(handles
        .into_iter()
        .filter_map(|handle| handle.join().ok())
        .collect())
}

#[tauri::command]
pub fn sample_curves_batch(
    tracks: Vec<Track>,
    speeds: Vec<f64>,
    curve_set: CurveSetKind,
) -> Result<Vec<SampledTrackCurves>, String> {
    tracks
        .into_iter()
        .map(|track| {
            let track_id = track.id.clone();
            let curve_set_data = track.curve_set(curve_set)?.clone();
            Ok(SampledTrackCurves {
                track_id,
                pitch: speeds
                    .iter()
                    .map(|speed| sample_curve(&curve_set_data.pitch, *speed))
                    .collect(),
                volume: speeds
                    .iter()
                    .map(|speed| sample_curve(&curve_set_data.volume, *speed))
                    .collect(),
            })
        })
        .collect()
}

#[tauri::command]
pub fn pack_msep_file(
    path: String,
    document: ProjectDocument,
    asset_payloads: HashMap<String, Vec<u8>>,
) -> Result<(), String> {
    ensure_msep_path(&path)?;
    let bytes = create_msep_archive(&document, &asset_payloads)?;
    fs::write(path, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_msep_file(path: String) -> Result<LoadedNativeProject, String> {
    ensure_msep_path(&path)?;
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(|error| error.to_string())?;

    let project = {
        let mut entry = archive
            .by_name(PROJECT_FILE_NAME)
            .map_err(|_| "Invalid .msep file: project.json is missing.".to_string())?;
        let mut contents = String::new();
        entry
            .read_to_string(&mut contents)
            .map_err(|error| error.to_string())?;
        serde_json::from_str::<ProjectFile>(&contents).map_err(|error| error.to_string())?
    };

    let mut tracks = {
        let mut entry = archive
            .by_name(TRACKS_FILE_NAME)
            .map_err(|_| "Invalid .msep file: tracks.json is missing.".to_string())?;
        let mut contents = String::new();
        entry
            .read_to_string(&mut contents)
            .map_err(|error| error.to_string())?;
        serde_json::from_str::<TracksFile>(&contents).map_err(|error| error.to_string())?
    };

    let mut asset_payloads = HashMap::new();
    for asset in &mut tracks.assets {
        let mut entry = match archive.by_name(&asset.packaged_path) {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let mut asset_bytes = Vec::new();
        entry
            .read_to_end(&mut asset_bytes)
            .map_err(|error| error.to_string())?;

        if asset.duration_sec.is_none() || asset.sample_rate.is_none() || asset.channels.is_none() {
            if let Ok(decoded) = decode_audio_source(
                None,
                Some(asset.file_name.clone()),
                Some(asset_bytes.clone()),
            ) {
                let metadata = metadata_from_decoded_audio(&decoded);
                asset.duration_sec = metadata.duration_sec;
                asset.sample_rate = metadata.sample_rate;
                asset.channels = metadata.channels;
            }
        }

        asset_payloads.insert(asset.id.clone(), asset_bytes);
    }

    Ok(LoadedNativeProject {
        document: ProjectDocument { project, tracks },
        asset_payloads,
    })
}

#[tauri::command]
pub fn export_bve_project(
    document: ProjectDocument,
    asset_payloads: HashMap<String, Vec<u8>>,
    output_path: String,
    options: BveExportOptions,
) -> Result<(), String> {
    if options.format != "bve" {
        return Err("Only BVE export is currently supported.".to_string());
    }

    let archive = create_bve_archive(&document, &asset_payloads, &options)?;
    fs::write(output_path, archive).map_err(|error| error.to_string())
}
