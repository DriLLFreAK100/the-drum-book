#!/usr/bin/env python3
"""
Generate compliant MusicXML files that match MuseScore format.
"""

import os
from io import StringIO

def create_container_xml():
    """Create the container.xml for MXL file."""
    return """<?xml version="1.0" encoding="UTF-8"?>
<container>
  <rootfiles>
    <rootfile full-path="score.xml">
      </rootfile>
    </rootfiles>
  </container>
"""

def create_score_xml_header(title):
    """Create the header of the score.xml file."""
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n'
    xml += '<score-partwise version="4.0">\n'
    xml += '  <work>\n'
    xml += f'    <work-title>{title}</work-title>\n'
    xml += '    </work>\n'
    xml += '  <identification>\n'
    xml += '    <creator type="composer">Composer / arranger</creator>\n'
    xml += '    <encoding>\n'
    xml += '      <software>MuseScore Studio 4.6.5</software>\n'
    xml += '      <encoding-date>2026-03-14</encoding-date>\n'
    xml += '      <supports element="accidental" type="yes"/>\n'
    xml += '      <supports element="beam" type="yes"/>\n'
    xml += '      <supports element="print" attribute="new-page" type="yes" value="yes"/>\n'
    xml += '      <supports element="print" attribute="new-system" type="yes" value="yes"/>\n'
    xml += '      <supports element="stem" type="yes"/>\n'
    xml += '      </encoding>\n'
    xml += '    <miscellaneous>\n'
    xml += '      <miscellaneous-field name="creationDate">2026-03-14</miscellaneous-field>\n'
    xml += '      <miscellaneous-field name="platform">Apple Macintosh</miscellaneous-field>\n'
    xml += '      </miscellaneous>\n'
    xml += '    </identification>\n'
    xml += '  <defaults>\n'
    xml += '    <scaling>\n'
    xml += '      <millimeters>6.99911</millimeters>\n'
    xml += '      <tenths>40</tenths>\n'
    xml += '      </scaling>\n'
    xml += '    <page-layout>\n'
    xml += '      <page-height>1696.94</page-height>\n'
    xml += '      <page-width>1200.48</page-width>\n'
    xml += '      <page-margins type="even">\n'
    xml += '        <left-margin>85.7252</left-margin>\n'
    xml += '        <right-margin>85.7252</right-margin>\n'
    xml += '        <top-margin>85.7252</top-margin>\n'
    xml += '        <bottom-margin>85.7252</bottom-margin>\n'
    xml += '        </page-margins>\n'
    xml += '      <page-margins type="odd">\n'
    xml += '        <left-margin>85.7252</left-margin>\n'
    xml += '        <right-margin>85.7252</right-margin>\n'
    xml += '        <top-margin>85.7252</top-margin>\n'
    xml += '        <bottom-margin>85.7252</bottom-margin>\n'
    xml += '        </page-margins>\n'
    xml += '      </page-layout>\n'
    xml += '    </defaults>\n'
    xml += '  <credit page="1">\n'
    xml += '    <credit-type>title</credit-type>\n'
    xml += f'    <credit-words default-x="600.241935" default-y="1611.210312" justify="center" valign="top" font-size="22">{title}</credit-words>\n'
    xml += '    </credit>\n'
    return xml

def create_part_list():
    """Create the part-list element for percussion."""
    xml = '  <part-list>\n'
    xml += '    <score-part id="P1">\n'
    xml += '      <part-name>Snare Drum</part-name>\n'
    xml += '      <part-abbreviation>SD</part-abbreviation>\n'
    xml += '      <score-instrument id="P1-I39">\n'
    xml += '        <instrument-name>Snare</instrument-name>\n'
    xml += '        </score-instrument>\n'
    xml += '      <midi-device port="1"></midi-device>\n'
    xml += '      <midi-instrument id="P1-I39">\n'
    xml += '        <midi-channel>10</midi-channel>\n'
    xml += '        <midi-program>49</midi-program>\n'
    xml += '        <midi-unpitched>39</midi-unpitched>\n'
    xml += '        <volume>78.7402</volume>\n'
    xml += '        <pan>0</pan>\n'
    xml += '        </midi-instrument>\n'
    xml += '      </score-part>\n'
    xml += '    </part-list>\n'
    return xml

def create_note(is_accented, beam_info=None, note_type='eighth', beam1_info=None, beam2_info=None):
    """Create a note element.
    
    Args:
        is_accented: Whether to add accent articulation
        beam_info: For single beam (backward compatibility), e.g. 'begin', 'continue', 'end'
        note_type: The note type, e.g. 'eighth', '16th'
        beam1_info: For dual beams - beam number 1 info
        beam2_info: For dual beams - beam number 2 info
    """
    xml = '      <note default-x="0" default-y="0">\n'
    xml += '        <unpitched>\n'
    xml += '          <display-step>E</display-step>\n'
    xml += '          <display-octave>4</display-octave>\n'
    xml += '          </unpitched>\n'
    xml += '        <duration>1</duration>\n'
    xml += '        <instrument id="P1-I39"/>\n'
    xml += '        <voice>1</voice>\n'
    xml += f'        <type>{note_type}</type>\n'
    xml += '        <stem>up</stem>\n'
    
    # Handle dual beams (for 16th notes)
    if beam1_info is not None and beam2_info is not None:
        xml += f'        <beam number="1">{beam1_info}</beam>\n'
        xml += f'        <beam number="2">{beam2_info}</beam>\n'
    # Handle single beam (for triplets and backward compatibility)
    elif beam_info:
        xml += f'        <beam number="1">{beam_info}</beam>\n'
    
    if is_accented:
        xml += '        <notations>\n'
        xml += '          <articulations>\n'
        xml += '            <accent default-x="-0.72" default-y="-9.3" relative-x="4.55" relative-y="52.27"/>\n'
        xml += '            </articulations>\n'
        xml += '          </notations>\n'
    
    xml += '      </note>\n'
    return xml

def create_measure_for_triplet_pattern(measure_num, pattern, is_first_measure):
    """Create a measure for 8th note triplet pattern (12/8 time signature)."""
    measure_xml = f'    <measure number="{measure_num}"'
    measure_xml += ' width="523.31">\n' if is_first_measure else '>\n'
    
    # Add print/system layout for first measure only
    if is_first_measure:
        measure_xml += '      <print>\n'
        measure_xml += '        <system-layout>\n'
        measure_xml += '          <system-margins>\n'
        measure_xml += '            <left-margin>50</left-margin>\n'
        measure_xml += '            <right-margin>0</right-margin>\n'
        measure_xml += '            </system-margins>\n'
        measure_xml += '          <top-system-distance>170</top-system-distance>\n'
        measure_xml += '          </system-layout>\n'
        measure_xml += '        </print>\n'
    
    # Add attributes only to first measure
    if is_first_measure:
        measure_xml += '      <attributes>\n'
        measure_xml += '        <divisions>2</divisions>\n'
        measure_xml += '        <key>\n'
        measure_xml += '          <fifths>0</fifths>\n'
        measure_xml += '          <mode>none</mode>\n'
        measure_xml += '          </key>\n'
        measure_xml += '        <time>\n'
        measure_xml += '          <beats>12</beats>\n'
        measure_xml += '          <beat-type>8</beat-type>\n'
        measure_xml += '          </time>\n'
        measure_xml += '        <clef>\n'
        measure_xml += '          <sign>percussion</sign>\n'
        measure_xml += '          </clef>\n'
        measure_xml += '        <staff-details>\n'
        measure_xml += '          <staff-lines>1</staff-lines>\n'
        measure_xml += '          </staff-details>\n'
        measure_xml += '        </attributes>\n'
    
    # Parse pattern and create notes
    # Pattern like "100 010 001 100" = 4 triplets (groups of 3 notes)
    triplet_groups = pattern.split()
    
    for group_idx, group in enumerate(triplet_groups):
        for note_idx, note_char in enumerate(group):
            is_accented = note_char == '1'
            
            # Determine beam info
            if note_idx == 0:
                beam_info = 'begin'
            elif note_idx == 2:
                beam_info = 'end'
            else:
                beam_info = 'continue'
            
            measure_xml += create_note(is_accented, beam_info)
    
    measure_xml += '    </measure>\n'
    return measure_xml

def create_measure_for_16th_pattern(measure_num, pattern, is_first_measure):
    """Create a measure for 16th note pattern (4/4 time signature)."""
    measure_xml = f'    <measure number="{measure_num}"'
    measure_xml += ' width="523.31">\n' if is_first_measure else '>\n'
    
    # Add print/system layout for first measure only
    if is_first_measure:
        measure_xml += '      <print>\n'
        measure_xml += '        <system-layout>\n'
        measure_xml += '          <system-margins>\n'
        measure_xml += '            <left-margin>50</left-margin>\n'
        measure_xml += '            <right-margin>0</right-margin>\n'
        measure_xml += '            </system-margins>\n'
        measure_xml += '          <top-system-distance>170</top-system-distance>\n'
        measure_xml += '          </system-layout>\n'
        measure_xml += '        </print>\n'
    
    # Add attributes only to first measure
    if is_first_measure:
        measure_xml += '      <attributes>\n'
        measure_xml += '        <divisions>4</divisions>\n'
        measure_xml += '        <key>\n'
        measure_xml += '          <fifths>0</fifths>\n'
        measure_xml += '          <mode>none</mode>\n'
        measure_xml += '          </key>\n'
        measure_xml += '        <time>\n'
        measure_xml += '          <beats>4</beats>\n'
        measure_xml += '          <beat-type>4</beat-type>\n'
        measure_xml += '          </time>\n'
        measure_xml += '        <clef>\n'
        measure_xml += '          <sign>percussion</sign>\n'
        measure_xml += '          </clef>\n'
        measure_xml += '        <staff-details>\n'
        measure_xml += '          <staff-lines>1</staff-lines>\n'
        measure_xml += '          </staff-details>\n'
        measure_xml += '        </attributes>\n'
    
    # Parse pattern and create notes with dual beams
    # Pattern like "1000 0100 0010 0001" = 4 beats (groups of 4 notes)
    # Each beat has 4 16th notes with dual beam numbering
    note_groups = pattern.split()
    
    note_idx = 0
    for group_idx, group in enumerate(note_groups):
        for note_pos, note_char in enumerate(group):
            is_accented = note_char == '1'
            
            # Determine beam info for both beam 1 and beam 2
            # Each beat: begin, continue, continue, end
            if note_pos == 0:
                beam1_info = 'begin'
                beam2_info = 'begin'
            elif note_pos == 3:
                beam1_info = 'end'
                beam2_info = 'end'
            else:
                beam1_info = 'continue'
                beam2_info = 'continue'
            
            measure_xml += create_note(is_accented, note_type='16th', beam1_info=beam1_info, beam2_info=beam2_info)
            note_idx += 1
    
    measure_xml += '    </measure>\n'
    return measure_xml

def create_mxl_file(output_path, title, measures_data, note_type='triplet'):
    """Create a complete MusicXML file."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Create score.xml content
    score_xml = create_score_xml_header(title)
    score_xml += create_part_list()
    score_xml += '  <part id="P1">\n'
    
    # Add all measures
    for measure_num, pattern in enumerate(measures_data, 1):
        if note_type == 'triplet':
            score_xml += create_measure_for_triplet_pattern(measure_num, pattern, measure_num == 1)
        else:  # 16th
            score_xml += create_measure_for_16th_pattern(measure_num, pattern, measure_num == 1)
    
    score_xml += '  </part>\n'
    score_xml += '</score-partwise>\n'
    
    # Write MusicXML file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(score_xml)

def parse_mxl_config(config_str):
    """Parse mxl config string like 'time-sig=4/4, note-type=16th'
    
    Returns dict with 'time_sig' and 'note_type' keys.
    """
    config = {}
    parts = config_str.split(',')
    for part in parts:
        part = part.strip()
        if '=' in part:
            key, value = part.split('=', 1)
            key = key.strip().replace('-', '_')
            value = value.strip()
            config[key] = value
    return config

def extract_sections_from_markdown(file_path):
    """Extract sections marked with <!-- mxl: ... --> comments.
    
    Returns list of dicts with keys: 'title', 'time_sig', 'note_type', 'bars', 'output_filename'
    """
    import re
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    sections = []
    lines = content.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Look for mxl config comments
        if '<!-- mxl:' in line and '-->' in line:
            # Extract config
            config_start = line.index('<!-- mxl:') + len('<!-- mxl:')
            config_end = line.index('-->')
            config_str = line[config_start:config_end].strip()
            config = parse_mxl_config(config_str)
            
            # Get title from next heading (prefer ## over #)
            title = None
            title_level = 0
            bars = []
            
            # Look ahead for the next heading or bar patterns
            i += 1
            while i < len(lines):
                next_line = lines[i]
                
                # Stop if we hit another mxl comment
                if '<!-- mxl:' in next_line:
                    i -= 1
                    break
                
                # Extract title from heading (prefer ## level)
                if next_line.startswith('##') and not next_line.startswith('###'):
                    # This is a ## heading
                    if title is None or title_level < 2:
                        title = next_line.lstrip('#').strip()
                        title_level = 2
                    i += 1
                    continue
                elif next_line.startswith('#') and title is None:
                    # This is a # heading, use only if we haven't found better
                    title = next_line.lstrip('#').strip()
                    title_level = 1
                    i += 1
                    continue
                
                # Extract bar patterns
                if next_line.strip().startswith('Bar'):
                    parts = next_line.split(':', 1)
                    if len(parts) == 2:
                        pattern = parts[1].strip()
                        # Remove trailing comments in parentheses
                        if '(' in pattern:
                            pattern = pattern.split('(')[0].strip()
                        bars.append(pattern)
                
                i += 1
            
            # Only add if we found bars and title
            if bars and title:
                # Generate output filename from title
                # "Mixed Accents Exercise 1 (32 Bars)" -> "mixed-accents-1"
                # "Single Accent Exercise (32 Bars)" -> "single-accent"
                # "16th Note" -> "16th-note"
                output_filename = title.lower()
                # Remove " (X Bars)" patterns
                output_filename = re.sub(r'\s*\(\d+\s+bars?\)\s*', '', output_filename, flags=re.IGNORECASE)
                # Remove the word "exercise" (with optional spaces)
                output_filename = re.sub(r'\s+exercise(\s+|$)', r'\1', output_filename, flags=re.IGNORECASE)
                output_filename = output_filename.strip()
                # Replace spaces with hyphens
                output_filename = output_filename.replace(' ', '-')
                
                sections.append({
                    'title': title,
                    'time_sig': config.get('time_sig', '4/4'),
                    'note_type': config.get('note_type', '16th'),
                    'bars': bars,
                    'output_filename': output_filename
                })
        
        i += 1
    
    return sections

def get_exercise_type_from_config(time_sig, note_type):
    """Determine if exercise is 'triplet' or 'sixteenth' based on config."""
    if note_type == 'eighth' and '12/8' in time_sig:
        return 'triplet'
    else:
        return 'sixteenth'

def main():
    """Generate all MusicXML files based on mxl convention markers in markdown."""
    # Get the exercises directory relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    exercises_dir = os.path.join(script_dir, '../../exercises')
    
    # Scan for all index.md files under exercises/*/
    exercise_folders = [d for d in os.listdir(exercises_dir) 
                       if os.path.isdir(os.path.join(exercises_dir, d))]
    
    processed_count = 0
    for folder_name in sorted(exercise_folders):
        file_path = os.path.join(exercises_dir, folder_name, 'index.md')
        
        # Skip if index.md doesn't exist
        if not os.path.exists(file_path):
            continue
        
        output_path = os.path.join(exercises_dir, folder_name, 'resources')
        
        # Extract sections marked with mxl convention
        sections = extract_sections_from_markdown(file_path)
        
        # Create output directory
        os.makedirs(output_path, exist_ok=True)
        
        # Generate MXL files for each section
        for section in sections:
            # Determine exercise type based on time signature and note type
            exercise_type = get_exercise_type_from_config(section['time_sig'], section['note_type'])
            
            output_file = os.path.join(output_path, f"{section['output_filename']}.musicxml")
            create_mxl_file(output_file, section['title'], section['bars'], exercise_type)
            print(f"✓ Generated: {section['output_filename']}.musicxml ({len(section['bars'])} bars)")
            processed_count += 1
    
    print(f"\n✓ All MusicXML files generated successfully! ({processed_count} files)")

if __name__ == '__main__':
    main()
