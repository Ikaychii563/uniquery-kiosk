import { useEffect, useRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
// The proper animation imports
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from "@pixiv/three-vrm-animation";

// Notice we are taking in 'customAvatarRef' here now, no forwardRef needed!
const VRMAvatar = ({ modelPath = "/VRM/UniQwery.vrm", vrmaGestures = [], customAvatarRef }) => {
  const containerRef = useRef(null);

  const actionsRef = useRef([]);
  const currentActionRef = useRef({ action: null, index: null });
  const mixerRef = useRef(null);

  // Exposing our switchGesture function to the smuggled ref
  useImperativeHandle(customAvatarRef, () => ({
    switchGesture: (gestureIndex) => {
      console.log(`Button clicked! Trying to play gesture index: ${gestureIndex}`);
      
      const action = actionsRef.current[gestureIndex];
      if (!action) {
        console.warn(`Wait, action ${gestureIndex} is missing! Did the file fail to load?`);
        return;
      }
      
      if (currentActionRef.current.index === gestureIndex) {
        console.log("Already playing this gesture, ignoring.");
        return;
      }

      if (currentActionRef.current.action) currentActionRef.current.action.stop();

      action.reset();
      action.play();
      currentActionRef.current = { action, index: gestureIndex };
      console.log("Animation playing!");
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    let scene, camera, renderer, vrm, clock;
    
    // Set up the main loader for the VRM avatar
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = null;

   const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 20);
    
    // 1. Camera is at shoulder level, 3.5 meters back
    camera.position.set(0, 1.4, 8.5); 

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // 2. Set up the controls
    const controls = new OrbitControls(camera, renderer.domElement);
    
    // 3. Aim at the chest/face
    controls.target.set(0, 1.4, 0); 
    
    // 4. THE MISSING MAGIC WORD: Tell the tripod to apply the new angle!
    controls.update(); 
    
    // 5. Now we lock all the interaction knobs
    controls.enableZoom = false;   
    controls.enableRotate = false; 
    controls.enablePan = false;  
 
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(1, 2, 3);
    scene.add(dirLight);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
    // Load the main VRM model
    loader.load(modelPath, (gltf) => {
      vrm = gltf.userData.vrm;
      VRMUtils.removeUnnecessaryJoints(vrm.scene);
      scene.add(vrm.scene);

      const mixer = new THREE.AnimationMixer(vrm.scene);
      mixerRef.current = mixer;

      // ---------------------------------------------------------
      // THE FIX IS HERE: Loading VRMA animations properly
      // ---------------------------------------------------------
      const vrmaLoader = new GLTFLoader(); // We use GLTFLoader, not VRMALoader
      vrmaLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));

      vrmaGestures.forEach((gesturePath, i) => {
        vrmaLoader.load(gesturePath, (vrmaGltf) => {
          const vrmAnimation = vrmaGltf.userData.vrmAnimations?.[0];
          if (!vrmAnimation) return;

          // Bind the animation to our specific avatar's skeleton
          const clip = createVRMAnimationClip(vrmAnimation, vrm);
          const action = mixer.clipAction(clip);
          actionsRef.current[i] = action;

          // Auto-play the first gesture (Waving) just to test it works
          if (i === 0) {
            action.play();
            currentActionRef.current = { action, index: 0 };
          }
        });
      });
    });

    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      
      // 1. The mixer moves the raw skeleton bones
      if (mixerRef.current) mixerRef.current.update(delta);
      
      // 2. The VRM system applies physics, constraints, and finalizes the pose
      // ADD THIS LINE:
      if (vrm) vrm.update(delta); 

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      scene.clear();
    };
  }, [modelPath, vrmaGestures]);

  return <div ref={containerRef} className="w-full h-full flex justify-center items-center" />;
};

export default VRMAvatar;