import React from "react";
import { Composition } from "remotion";
import { OneInOne } from "./OneInOne";
import { DiagnosticBias } from "./DiagnosticBias";
import { ResearchVoid } from "./ResearchVoid";
import { DualEntry } from "./DualEntry";
import { SixLayers } from "./SixLayers";
import { ConfidenceFlag } from "./ConfidenceFlag";
import { IBDColEpiPivot } from "./IBDColEpiPivot";
import { HundredTwins } from "./HundredTwins";
import { FinalCard } from "./FinalCard";

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="OneInOne"
        component={OneInOne}
        durationInFrames={180}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="DiagnosticBias"
        component={DiagnosticBias}
        durationInFrames={180}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="ResearchVoid"
        component={ResearchVoid}
        durationInFrames={180}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="DualEntry"
        component={DualEntry}
        durationInFrames={195}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="SixLayers"
        component={SixLayers}
        durationInFrames={180}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="ConfidenceFlag"
        component={ConfidenceFlag}
        durationInFrames={180}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="IBDColEpiPivot"
        component={IBDColEpiPivot}
        durationInFrames={195}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="HundredTwins"
        component={HundredTwins}
        durationInFrames={180}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="FinalCard"
        component={FinalCard}
        durationInFrames={165}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
