import React from "react";

const BORDER_WIDTH = 5
const BORDER_RADIUS = 17
const LAYERS_SPACING = 29

const BLACK = 'rgb(34, 42, 65)'
const WHITE = 'rgb(255, 255, 255)'
const GRAY = 'rgb(93, 136, 167)'
const BLUE_1 = 'rgb(131, 199, 235)'
const BLUE_2 = 'rgb(81, 159, 199)'
const BLUE_3 = 'rgb(30, 106, 140)'

interface HeaderProps {
  text: string
}

function Header({ text }: HeaderProps): React.ReactElement {
  const SHADOW_STEPS = 15
  return (
    <div style={{ display: 'flex', flex: 1 }}>
      <div style={{
        display: 'flex',
        position: 'relative',
        flex: 1,
      }}>
        {Array(SHADOW_STEPS).fill(0).map((_, i) => {
          const isLast = i === (SHADOW_STEPS - 1)
          return (
            <div
              key={i}
              style={{
                // position in parent
                position: 'absolute',
                width: '100%',
                // text layout
                fontFamily: 'ClashDisplay',
                fontSize: 120,
                lineHeight: 1,
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                hyphens: 'auto',
                // truncation
                maxLines: 3,
                textOverflow: 'ellipsis',
                // styling
                color: isLast ? WHITE : BLACK,
                WebkitTextStrokeColor: BLACK,
                WebkitTextStrokeWidth: 15,
                paintOrder: 'stroke',
                transform: `translate(${i}px, -${i}px)`,
                pointerEvents: 'none',  // layers don't catch events
              }}
            >
              {text}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export interface NitroOgCardProps {
  title: string
  subtitle?: string
  url?: string
}

export function NitroOgCard({ title, subtitle, url }: NitroOgCardProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        height: '100%',
        boxSizing: 'border-box',
        backgroundColor: BLUE_3,
        paddingRight: LAYERS_SPACING,
        paddingBottom: LAYERS_SPACING,
      }}
    >
      <div
        style={{
          display: 'flex',
          flex: 1,
          height: '100%',
          boxSizing: 'border-box',
          backgroundColor: BLUE_2,
          borderBottomWidth: BORDER_WIDTH,
          borderRightWidth: BORDER_WIDTH,
          borderColor: BLACK,
          borderBottomStyle: 'solid',
          borderRightStyle: 'solid',
          borderBottomRightRadius: BORDER_RADIUS,
          paddingRight: LAYERS_SPACING,
          paddingBottom: LAYERS_SPACING,
        }}
      >
        <div
          style={{
            display: 'flex',
            flex: 1,
            height: '100%',
            boxSizing: 'border-box',
            backgroundColor: BLUE_1,
            borderBottomWidth: BORDER_WIDTH,
            borderRightWidth: BORDER_WIDTH,
            borderColor: BLACK,
            borderBottomStyle: 'solid',
            borderRightStyle: 'solid',
            borderBottomRightRadius: BORDER_RADIUS,
            paddingLeft: '7%',
            paddingTop: '7%',
            paddingRight: '9%',
            flexDirection: 'column'
          }}
        >
          <Header text={title} />

          {subtitle != null && (
            <div
              style={{
                paddingTop: '5%',
                paddingBottom: '3%',
                maxWidth: '70%',
                fontFamily: 'Inter',
                color: BLACK,
                fontSize: 39
              }}
            >
              {subtitle}
            </div>
          )}

          {url != null && (
            <div
              style={{
                paddingTop: '6%',
                paddingBottom: '3%',
                fontFamily: 'Inter',
                color: GRAY,
                fontSize: 38
              }}
            >
              {url}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
